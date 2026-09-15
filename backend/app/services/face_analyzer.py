"""Face analysis service using MediaPipe."""
import numpy as np
from typing import Dict

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    print("[WARNING] opencv-python not installed. Face analysis will use fallback mode.")

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    print("[WARNING] mediapipe not installed. Face analysis will use fallback mode.")

from ..models.evaluation import FaceAnalysisResult


class FaceAnalyzer:
    """Face analysis service using MediaPipe Face Mesh."""
    
    def __init__(self):
        """Initialize face analyzer."""
        self.face_mesh = None
        
        if MEDIAPIPE_AVAILABLE and CV2_AVAILABLE:
            try:
                mp_face_mesh = mp.solutions.face_mesh
                self.face_mesh = mp_face_mesh.FaceMesh(
                    max_num_faces=1,
                    refine_landmarks=True,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
                print("[OK] MediaPipe Face Mesh initialized")
            except Exception as e:
                print(f"[WARN] Could not initialize MediaPipe: {e}")
        else:
            print("[INFO] Face analysis running in fallback mode (cv2/mediapipe not available)")
    
    def analyze_frame(self, frame_bytes: bytes) -> FaceAnalysisResult:
        """
        Analyze a video frame for face landmarks and expressions.
        
        Args:
            frame_bytes: JPEG encoded frame bytes
            
        Returns:
            FaceAnalysisResult with mouth and stress metrics
        """
        if not CV2_AVAILABLE:
            # Fallback when cv2 is not installed
            return FaceAnalysisResult(
                face_detected=False,
                mouth_open_ratio=0.0,
                mouth_is_open=False,
                stress_level=0.0,
                emotion="neutral"
            )

        try:
            # Decode image
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                return FaceAnalysisResult(face_detected=False)
            
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            if not self.face_mesh:
                # Fallback: return neutral values
                return FaceAnalysisResult(
                    face_detected=False,
                    mouth_open_ratio=0.0,
                    mouth_is_open=False,
                    stress_level=0.0,
                    emotion="neutral"
                )
            
            # Process frame
            results = self.face_mesh.process(rgb_frame)
            
            if not results.multi_face_landmarks:
                return FaceAnalysisResult(face_detected=False)
            
            # Get first face landmarks
            landmarks = results.multi_face_landmarks[0]
            
            # Calculate mouth metrics
            mouth_open_ratio, mouth_is_open = self._calculate_mouth_metrics(
                landmarks,
                frame.shape
            )
            
            # Calculate stress level from brow/forehead tension
            stress_level = self._calculate_stress_level(landmarks, frame.shape)
            
            # Determine emotion
            emotion = self._determine_emotion(mouth_is_open, stress_level)
            
            return FaceAnalysisResult(
                face_detected=True,
                mouth_open_ratio=mouth_open_ratio,
                mouth_is_open=mouth_is_open,
                stress_level=stress_level,
                emotion=emotion
            )
            
        except Exception as e:
            print(f"[ERROR] Error in analyze_frame: {e}")
            return FaceAnalysisResult(face_detected=False)
    
    def _calculate_mouth_metrics(self, landmarks, frame_shape: tuple) -> tuple:
        """Calculate mouth open ratio and status."""
        try:
            h, w = frame_shape[:2]
            upper_lip = landmarks.landmark[13]
            lower_lip = landmarks.landmark[14]
            left_corner = landmarks.landmark[61]
            right_corner = landmarks.landmark[291]
            mouth_height = abs(lower_lip.y - upper_lip.y) * h
            mouth_width = abs(right_corner.x - left_corner.x) * w
            if mouth_width > 0:
                mouth_open_ratio = mouth_height / mouth_width
            else:
                mouth_open_ratio = 0.0
            mouth_is_open = mouth_open_ratio > 0.35
            return float(mouth_open_ratio), mouth_is_open
        except Exception as e:
            print(f"[ERROR] Error calculating mouth metrics: {e}")
            return 0.0, False
    
    def _calculate_stress_level(self, landmarks, frame_shape: tuple) -> float:
        """Calculate stress level from brow landmarks."""
        try:
            h, w = frame_shape[:2]
            left_brow_inner = landmarks.landmark[70]
            right_brow_inner = landmarks.landmark[300]
            brow_distance = abs(right_brow_inner.x - left_brow_inner.x) * w
            normalized_distance = brow_distance / (w * 0.12)
            stress_level = max(0, min(1, 1.5 - normalized_distance))
            return float(stress_level)
        except Exception as e:
            print(f"[ERROR] Error calculating stress: {e}")
            return 0.0
    
    def _determine_emotion(self, mouth_is_open: bool, stress_level: float) -> str:
        """Determine basic emotion from face metrics."""
        if stress_level > 0.6:
            return "stressed"
        elif stress_level > 0.3:
            return "focused"
        elif mouth_is_open:
            return "engaged"
        else:
            return "calm"


# Global instance
face_analyzer = FaceAnalyzer()

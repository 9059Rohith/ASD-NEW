import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useSettingsStore } from './store/settingsStore'
import { useInteractionSettingsStore } from './store/interactionSettingsStore'
import { authAPI } from './services/api'
import { canOpenRoleRoute, homeForRole } from './utils/roleRouting'
import ButterflyGarden from './features/home/ButterflyGarden'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ClinicianRegisterPage = lazy(() => import('./pages/ClinicianRegisterPage'))
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const VerifyOtpPage = lazy(() => import('./pages/VerifyOtpPage'))
const TherapyPage = lazy(() => import('./pages/TherapyPage'))
const UserDashboard = lazy(() => import('./pages/UserDashboard'))
const TrainingPage = lazy(() => import('./pages/TrainingPage'))
const AssessmentPage = lazy(() => import('./pages/AssessmentPage'))
const LetterLearningPage = lazy(() => import('./pages/LetterLearningPage'))
const VideosPage = lazy(() => import('./pages/VideosPage'))
const SpeechAnalysisPage = lazy(() => import('./pages/SpeechAnalysisPage'))
const TongueTrackingPage = lazy(() => import('./pages/TongueTrackingPage'))
const GamesPage = lazy(() => import('./pages/GamesPage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'))
const RewardsPage = lazy(() => import('./pages/RewardsPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'))
const ParentDashboard = lazy(() => import('./pages/ParentDashboard'))
const TherapistDashboard = lazy(() => import('./pages/TherapistDashboard'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const HelpPage = lazy(() => import('./pages/HelpPage'))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const InteractiveHomePage = lazy(() => import('./pages/InteractiveHomePage'))
const InteractionSettingsPage = lazy(() => import('./pages/InteractionSettingsPage'))
const BreathBalloonPage = lazy(() => import('./pages/BreathBalloonPage'))
const RiverRescuePage = lazy(() => import('./pages/RiverRescuePage'))
const MouthMirrorPage = lazy(() => import('./pages/MouthMirrorPage'))
const PippinPage = lazy(() => import('./pages/PippinPage'))
const TalkTogetherPage = lazy(() => import('./pages/TalkTogetherPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const NotFound = lazy(() => import('./pages/NotFound'))
const PracticePage = lazy(() => import('./pages/VowelPages').then(module => ({ default: module.PracticePage })))
const TrainingOverview = lazy(() => import('./pages/VowelPages').then(module => ({ default: module.TrainingOverview })))
const VowelGamesPage = lazy(() => import('./pages/VowelPages').then(module => ({ default: module.VowelGamesPage })))
const VowelGamePage = lazy(() => import('./pages/VowelPages').then(module => ({ default: module.VowelGamePage })))
const VowelEvaluationPage = lazy(() => import('./pages/VowelPages').then(module => ({ default: module.VowelEvaluationPage })))
const VowelProgressPage = lazy(() => import('./pages/VowelPages').then(module => ({ default: module.VowelProgressPage })))
const VowelCreditsPage = lazy(() => import('./pages/VowelPages').then(module => ({ default: module.VowelCreditsPage })))
const TamilLearningPage = lazy(() => import('./pages/TamilLearningPage'))
const TamilPracticePage = lazy(() => import('./pages/TamilPracticePage'))
const TamilQuizPage = lazy(() => import('./pages/TamilQuizPage'))
const TamilGamesPage = lazy(() => import('./pages/TamilGamesPage'))
const TamilProgressPage = lazy(() => import('./pages/TamilProgressPage'))

function App() {
  const initTheme = useSettingsStore((s) => s.initTheme)
  const { authReady, setUser, markAuthReady } = useAuthStore()
  const initializeInteraction = useInteractionSettingsStore((state) => state.initialize)
  const user = useAuthStore((state) => state.user)

  // Re-apply the persisted theme to <html> on first paint
  useEffect(() => {
    initTheme()
  }, [initTheme])

  useEffect(() => {
    let active = true
    authAPI.getMe()
      .then(({ data }) => active && setUser(data))
      .catch(() => active && markAuthReady())
    return () => { active = false }
  }, [markAuthReady, setUser])

  useEffect(() => {
    if (authReady && user) initializeInteraction({ age: user.child_age })
  }, [authReady, initializeInteraction, user])

  if (!authReady) {
    return <div className="app-loading" aria-live="polite">Loading ASD-Edge-ST...</div>
  }

  // Authenticated pages that all share the DashboardLayout shell
  const caregiver = ['user', 'admin']
  const careTeam = ['user', 'therapist', 'admin']
  const protectedRoutes = [
    { path: '/dashboard', element: <UserDashboard />, allow: caregiver },
    { path: '/training', element: <TamilLearningPage />, allow: caregiver },
    { path: '/tamil', element: <TamilLearningPage />, allow: caregiver },
    { path: '/tamil/practice/:itemId', element: <TamilPracticePage />, allow: caregiver },
    { path: '/tamil/quiz/:itemId', element: <TamilQuizPage />, allow: caregiver },
    { path: '/practice', element: <PracticePage />, allow: caregiver },
    { path: '/assessment', element: <VowelEvaluationPage />, allow: caregiver },
    { path: '/evaluate', element: <VowelEvaluationPage />, allow: caregiver },
    { path: '/assessment/letters', element: <AssessmentPage />, allow: caregiver },
    { path: '/letter-learning', element: <LetterLearningPage />, allow: caregiver },
    { path: '/videos', element: <VideosPage />, allow: caregiver },
    { path: '/speech-analysis', element: <SpeechAnalysisPage />, allow: caregiver },
    { path: '/tongue-tracking', element: <TongueTrackingPage />, allow: caregiver },
    { path: '/games', element: <TamilGamesPage />, allow: caregiver },
    { path: '/games/vowels', element: <VowelGamesPage />, allow: caregiver },
    { path: '/games/vowels/:mode', element: <VowelGamePage />, allow: caregiver },
    { path: '/games/alphabet', element: <GamesPage />, allow: caregiver },
    { path: '/progress', element: <TamilProgressPage />, allow: caregiver },
    { path: '/progress/vowels', element: <VowelProgressPage />, allow: caregiver },
    { path: '/progress/lessons', element: <ProgressPage />, allow: caregiver },
    { path: '/reports', element: <ReportsPage />, allow: careTeam },
    { path: '/achievements', element: <AchievementsPage />, allow: caregiver },
    { path: '/rewards', element: <RewardsPage />, allow: caregiver },
    { path: '/calendar', element: <CalendarPage />, allow: caregiver },
    { path: '/notifications', element: <NotificationsPage />, allow: careTeam },
    { path: '/appointments', element: <AppointmentsPage />, allow: careTeam },
    { path: '/parent', element: <ParentDashboard />, allow: caregiver },
    { path: '/therapist', element: <TherapistDashboard />, allow: ['therapist', 'admin'] },
    { path: '/profile', element: <ProfilePage />, allow: careTeam },
    { path: '/settings', element: <SettingsPage />, allow: careTeam },
    { path: '/help', element: <HelpPage />, allow: careTeam },
    { path: '/feedback', element: <FeedbackPage />, allow: careTeam },
    { path: '/about', element: <AboutPage />, allow: careTeam },
    { path: '/play', element: <InteractiveHomePage />, allow: caregiver },
    { path: '/play/settings', element: <InteractionSettingsPage />, allow: caregiver },
    { path: '/play/arcade/breath-balloon', element: <BreathBalloonPage />, allow: caregiver },
    { path: '/play/quest/river-rescue', element: <RiverRescuePage />, allow: caregiver },
    { path: '/play/mouth-mirror', element: <MouthMirrorPage />, allow: caregiver },
    { path: '/play/pippin', element: <PippinPage />, allow: caregiver },
    { path: '/play/together', element: <TalkTogetherPage />, allow: caregiver },
  ]

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ButterflyGarden />
      <Suspense fallback={<div className="app-loading" aria-live="polite">Loading page...</div>}>
        <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/credits" element={<VowelCreditsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/clinician-register" element={<ClinicianRegisterPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-otp" element={<VerifyOtpPage />} />

        {/* Therapy sessions are caregiver activities. */}
        <Route
          path="/therapy/:lessonId"
          element={
            <RoleRoute allow={caregiver}>
              <TherapyPage />
            </RoleRoute>
          }
        />

        {/* Authenticated app pages */}
        {protectedRoutes.map(({ path, element, allow }) => (
          <Route
            key={path}
            path={path}
            element={<RoleRoute allow={allow}>{element}</RoleRoute>}
          />
        ))}

        {/* Admin — restricted to the admin role */}
        <Route
          path="/admin"
          element={
            <RoleRoute allow={['admin']}>
              <AdminPage />
            </RoleRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

// Role-gated route. `allow` is a list of roles permitted to view the page.
function RoleRoute({ children, allow }) {
  const { user, isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }
  if (allow && !canOpenRoleRoute(user.role, allow)) {
    return <Navigate to={homeForRole(user.role)} replace />
  }

  return children
}

export default App

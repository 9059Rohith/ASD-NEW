import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowLeft, Eye, EyeOff, Sparkles, Star, Brain, Shield } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { loginDestination } from '../utils/loginDestination'
import { homeForRole } from '../utils/roleRouting'
import '../styles/vowel-world.css'
import '../styles/responsive-backgrounds.css'

import happyBearImg from '../assets/images/happy_bear.png'
import strawberryImg from '../assets/images/strawberry_cartoon.png'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isDemoSubmitting, setIsDemoSubmitting] = useState(false)
  const { isAuthenticated, user, authReady } = useAuthStore()
  const setAuth = useAuthStore((state) => state.setAuth)
  const navigate = useNavigate()
  const location = useLocation()
  
  useEffect(() => {
    // The HttpOnly session cookie is restored by App before this route renders.
    const timer = setTimeout(() => {
      if (authReady && isAuthenticated && user) {
        navigate(loginDestination(user.role, location.state?.from), { replace: true })
      } else {
        setIsChecking(false)
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [authReady, isAuthenticated, user, navigate, location.state])
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema)
  })
  
  // Don't render anything while checking auth to prevent blink
  if (isChecking) {
    return <div className="app-loading" role="status">Getting your sign-in ready…</div>
  }
  
  const loginWithCredentials = async (data) => {
    try {
      const response = await authAPI.login(data)
      setAuth(response.data.user, response.data.access_token)
      toast.success(`Welcome back, ${response.data.user.full_name}!`)
      setTimeout(() => {
        navigate(loginDestination(response.data.user.role, location.state?.from), { replace: true })
      }, 100)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed. Please check your credentials.')
    }
  }

  const onSubmit = (data) => loginWithCredentials(data)

  const enterDemo = async () => {
    setIsDemoSubmitting(true)
    try {
      await loginWithCredentials({ email: 'demo@speakeasy.app', password: 'Demo@1234' })
    } finally {
      setIsDemoSubmitting(false)
    }
  }
  
  const floatingItems = [
    { emoji: '🗣️', x: '10%', y: '15%', delay: 0, duration: 6 },
    { emoji: '⭐', x: '85%', y: '20%', delay: 1, duration: 7 },
    { emoji: '🎤', x: '15%', y: '75%', delay: 2, duration: 5 },
    { emoji: '📖', x: '80%', y: '80%', delay: 0.5, duration: 8 },
    { emoji: '✨', x: '50%', y: '10%', delay: 1.5, duration: 6 },
  ]
  
  return (
    <div className="voice-world voice-auth min-h-screen flex">
      <div className="voice-auth-art hidden lg:flex">
        <img src="/assets/vowel-studio/pippin-garden.png" alt="Pippin welcomes you to a garden of sounds" />
        <h2>A familiar friend.<br /><em>A fresh beginning.</em></h2>
        <p>Explore Tamil vowels with Pippin. Listen, speak, and celebrate each small step together.</p>
      </div>
      
      {/* Right Panel — Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-white relative">
        <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md relative z-10"
        >
          <Link to="/" className="inline-flex items-center text-neutral-500 hover:text-primary-600 mb-8 transition text-sm font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-secondary-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">SE</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">Welcome Back!</h1>
                <p className="text-sm text-neutral-500">Sign in to continue your learning journey</p>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold text-neutral-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input id="login-email" autoComplete="email" {...register('email')} type="email"
                  className="w-full pl-12 pr-4 py-4 border-2 border-neutral-200 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-neutral-800"
                  placeholder="your@email.com" />
              </div>
              {errors.email && <p className="text-coral-500 text-sm mt-1.5">{errors.email.message}</p>}
            </div>
            
            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-neutral-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input id="login-password" autoComplete="current-password" {...register('password')} type={showPassword ? 'text' : 'password'}
                  className="w-full pl-12 pr-12 py-4 border-2 border-neutral-200 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-neutral-800"
                  placeholder="••••••••" />
                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-coral-500 text-sm mt-1.5">{errors.password.message}</p>}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm text-neutral-600"><Shield size={15} /> Secure sign-in</span>
              <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Forgot password?</Link>
            </div>
            
            <button type="submit" disabled={isSubmitting}
              className="btn-primary w-full !py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full inline-block" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>

            <div className="rounded-2xl border-2 border-primary-100 bg-primary-50/70 p-4">
              <div className="mb-3 flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-primary-600 shadow-sm">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-bold text-neutral-800">Try the complete demo</p>
                  <p className="text-sm text-neutral-500">demo@speakeasy.app · Demo@1234</p>
                </div>
              </div>
              <button
                type="button"
                onClick={enterDemo}
                disabled={isDemoSubmitting || isSubmitting}
                className="w-full rounded-xl border border-primary-200 bg-white px-4 py-3 font-bold text-primary-700 shadow-sm transition hover:border-primary-400 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDemoSubmitting ? 'Opening Demo...' : 'Enter Demo'}
              </button>
            </div>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-neutral-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-700 font-semibold">Create one free</Link>
            </p>
            <p className="mt-3 text-sm text-neutral-500">
              Speech therapist?{' '}
              <Link to="/clinician-register" className="font-semibold text-primary-600 hover:text-primary-700">Create a clinician workspace</Link>
            </p>
          </div>
          
          <div className="mt-6 pt-6 border-t border-neutral-200">
            <Link to="/admin-login" className="block text-center text-sm text-neutral-400 hover:text-neutral-600 transition">
              Admin Login →
            </Link>
          </div>
          
          <p className="text-center text-xs text-neutral-400 mt-8">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </motion.div>
      </div>
    </div>
  )
}

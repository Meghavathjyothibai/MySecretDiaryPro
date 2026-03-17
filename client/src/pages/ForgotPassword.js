import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Send, CheckCircle, Key, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { api } = useAuth();
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [emailError, setEmailError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const startCountdown = () => {
    setResendDisabled(true);
    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setEmailError('');

    if (!email) {
      setEmailError('Please enter your email address');
      toast.error('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      console.log('📤 Sending OTP request for:', email);
      
      const response = await api.post('/auth/forgot-password', { email });
      
      if (response.data.success) {
        toast.success('OTP sent to your email! Check your inbox (and spam folder)', {
          duration: 6000,
          icon: '📧'
        });
        setStep(2);
        startCountdown();
      } else {
        toast.error(response.data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('❌ Send OTP error:', error);
      
      let errorMessage = 'Failed to send OTP. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setEmailError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendDisabled) return;

    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      
      if (response.data.success) {
        toast.success('New OTP sent to your email!', {
          duration: 5000,
          icon: '📧'
        });
        startCountdown();
      }
    } catch (error) {
      console.error('❌ Resend OTP error:', error);
      toast.error(error.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError('');

    if (!otp) {
      setOtpError('Please enter the OTP');
      toast.error('Please enter the OTP');
      return;
    }

    if (otp.length !== 6) {
      setOtpError('OTP must be 6 digits');
      toast.error('OTP must be 6 digits');
      return;
    }

    if (!/^\d+$/.test(otp)) {
      setOtpError('OTP must contain only numbers');
      toast.error('OTP must contain only numbers');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/verify-otp', { email, otp });
      
      if (response.data.success) {
        toast.success('OTP verified successfully!', {
          icon: '✅',
          duration: 3000
        });
        setStep(3);
      } else {
        setOtpError(response.data.message || 'Invalid OTP');
        toast.error(response.data.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('❌ Verify OTP error:', error);
      
      const errorMessage = error.response?.data?.message || 'Invalid OTP. Please try again.';
      setOtpError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!newPassword) {
      setPasswordError('Please enter new password');
      toast.error('Please enter new password');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/reset-password', {
        email,
        otp,
        newPassword
      });
      
      if (response.data.success) {
        toast.success('Password reset successfully! Redirecting to login...', {
          duration: 3000,
          icon: '🎉'
        });
        
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
        
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Reset password error:', error);
      
      const errorMessage = error.response?.data?.message || 'Failed to reset password. Please try again.';
      setPasswordError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStepIcon = () => {
    switch(step) {
      case 1: return <Mail className="h-10 w-10 text-white" />;
      case 2: return <Key className="h-10 w-10 text-white" />;
      case 3: return <Lock className="h-10 w-10 text-white" />;
      default: return <Mail className="h-10 w-10 text-white" />;
    }
  };

  const getStepTitle = () => {
    switch(step) {
      case 1: return 'Forgot Password?';
      case 2: return 'Enter Verification Code';
      case 3: return 'Create New Password';
      default: return 'Forgot Password?';
    }
  };

  const getStepDescription = () => {
    switch(step) {
      case 1: return "Enter your email address and we'll send you a 6-digit verification code";
      case 2: return `Enter the 6-digit code sent to ${email}`;
      case 3: return 'Choose a strong password for your account';
      default: return '';
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <Link
          to="/login"
          className="inline-flex items-center text-gray-600 hover:text-purple-600 mb-8 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Login
        </Link>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
          <div className="flex justify-center mb-6">
            <motion.div
              key={step}
              initial={{ scale: 0.5, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg"
            >
              {getStepIcon()}
            </motion.div>
          </div>

          <motion.div
            key={`text-${step}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="text-3xl font-bold text-center mb-2">
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {getStepTitle()}
              </span>
            </h1>
            
            <p className="text-gray-600 text-center mb-8">
              {getStepDescription()}
            </p>
          </motion.div>

          {step === 1 && (
            <motion.form
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleSendOtp}
              className="space-y-6"
            >
              <div>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError('');
                    }}
                    placeholder="Enter your email"
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl outline-none transition-all
                              ${emailError 
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                                : 'border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                              }`}
                    required
                    disabled={loading}
                  />
                </div>
                {emailError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-6 rounded-xl 
                         hover:from-purple-700 hover:to-pink-700 transition-all duration-300 
                         hover:shadow-lg hover:shadow-purple-500/50 transform hover:scale-105
                         focus:ring-4 focus:ring-purple-300 focus:outline-none
                         flex items-center justify-center gap-2 
                         ${loading ? 'opacity-70 cursor-not-allowed hover:scale-100' : ''}`}
              >
                {loading ? (
                  <>
                    <div className="loader w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Send Verification Code
                  </>
                )}
              </button>
            </motion.form>
          )}

          {step === 2 && (
            <motion.form
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleVerifyOtp}
              className="space-y-6"
            >
              <div>
                <div className="relative group">
                  <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                      setOtpError('');
                    }}
                    placeholder="Enter 6-digit code"
                    maxLength="6"
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl outline-none transition-all text-center text-2xl tracking-widest
                              ${otpError 
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                                : 'border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                              }`}
                    required
                    disabled={loading}
                  />
                </div>
                {otpError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {otpError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-6 rounded-xl 
                         hover:from-purple-700 hover:to-pink-700 transition-all duration-300 
                         hover:shadow-lg hover:shadow-purple-500/50 transform hover:scale-105
                         focus:ring-4 focus:ring-purple-300 focus:outline-none
                         flex items-center justify-center gap-2
                         ${loading ? 'opacity-70 cursor-not-allowed hover:scale-100' : ''}`}
              >
                {loading ? (
                  <>
                    <div className="loader w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Verify Code
                  </>
                )}
              </button>

              <div className="flex items-center justify-between mt-4">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendDisabled || loading}
                  className={`text-purple-600 hover:text-purple-700 text-sm font-medium transition-colors
                           flex items-center gap-1
                           ${(resendDisabled || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <RefreshCw className={`h-4 w-4 ${resendDisabled ? 'animate-spin' : ''}`} />
                  {resendDisabled ? `Resend in ${countdown}s` : 'Resend Code'}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                >
                  Change Email
                </button>
              </div>
            </motion.form>
          )}

          {step === 3 && (
            <motion.form
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleResetPassword}
              className="space-y-6"
            >
              <div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError('');
                    }}
                    placeholder="Enter new password"
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl outline-none transition-all
                              ${passwordError 
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                                : 'border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                              }`}
                    required
                    minLength="6"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError('');
                    }}
                    placeholder="Confirm new password"
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl outline-none transition-all
                              ${passwordError 
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                                : 'border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                              }`}
                    required
                    minLength="6"
                    disabled={loading}
                  />
                </div>
                {passwordError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {passwordError}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2 ml-2">
                  Password must be at least 6 characters long
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-6 rounded-xl 
                         hover:from-purple-700 hover:to-pink-700 transition-all duration-300 
                         hover:shadow-lg hover:shadow-purple-500/50 transform hover:scale-105
                         focus:ring-4 focus:ring-purple-300 focus:outline-none
                         flex items-center justify-center gap-2
                         ${loading ? 'opacity-70 cursor-not-allowed hover:scale-100' : ''}`}
              >
                {loading ? (
                  <>
                    <div className="loader w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Resetting...
                  </>
                ) : (
                  <>
                    <Lock className="h-5 w-5" />
                    Reset Password
                  </>
                )}
              </button>
            </motion.form>
          )}

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              Need help?{' '}
              <a href="mailto:support@mysecretdiary.com" className="text-purple-600 hover:text-purple-700 font-medium">
                Contact Support
              </a>
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-center"
        >
          <p className="text-xs text-gray-500">
            🔒 This is a secure system. Your OTP will expire in 10 minutes.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
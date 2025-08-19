import * as XLSX from 'xlsx';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, EyeOff, Upload, Search, RefreshCw, ArrowLeft, FileVideo, 
  Trash2, Download, ExternalLink, Brain, Car, Zap, Sparkles,
  User, Lock, Globe, Shield, BarChart3, Plus, X, Link as LinkIcon,
  CheckCircle, XCircle, AlertCircle, Info, TrendingUp, Award, Play,
  Pause, Volume2, VolumeX, Maximize, RotateCcw
} from 'lucide-react';
import { apiService } from './services/api';

// Video Player Modal Component with improved error handling
// Video Player Modal Component with fixed "Open in New Tab"
const VideoPlayerModal = ({ isOpen, onClose, videoUrl, filename }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [processedVideoUrl, setProcessedVideoUrl] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const videoRef = React.useRef(null);
  const containerRef = React.useRef(null);

  // Process the video URL to handle different formats
  const processVideoUrl = (url) => {
    if (!url) return { processed: '', direct: '' };
    
    console.log('Processing URL:', url);
    
    // If it's already a proper HTTP URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return { processed: url, direct: url };
    }
    
    // If it's a gs:// URL, convert it to different HTTP formats
    if (url.startsWith('gs://')) {
      const gsUrl = url.replace('gs://', '');
      const [bucket, ...pathParts] = gsUrl.split('/');
      const filePath = pathParts.join('/');
      
      // Multiple formats to try
      const formats = {
        processed: `https://storage.googleapis.com/${bucket}/${filePath}`,
        direct: `https://storage.cloud.google.com/${bucket}/${filePath}`
      };
      
      console.log('Converted URLs:', formats);
      return formats;
    }
    
    return { processed: url, direct: url };
  };

  useEffect(() => {
    if (isOpen && videoUrl) {
      const { processed, direct } = processVideoUrl(videoUrl);
      setProcessedVideoUrl(processed);
      setDirectUrl(direct);
      setIsLoading(true);
      setHasError(false);
      setErrorMessage('');
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      
      console.log('Original URL:', videoUrl);
      console.log('Processed URL:', processed);
      console.log('Direct URL:', direct);
    }
  }, [isOpen, videoUrl]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Error playing video:', error);
            setErrorMessage('Cannot play video. This may be due to browser security policies.');
          });
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  };

  const handleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (containerRef.current.mozRequestFullScreen) {
        containerRef.current.mozRequestFullScreen();
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      } else if (containerRef.current.msRequestFullscreen) {
        containerRef.current.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleRestart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      if (!isPlaying) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => setIsPlaying(true)).catch(error => {
            console.error('Error playing video:', error);
          });
        }
      }
    }
  };

  const handleVideoError = (e) => {
    setIsLoading(false);
    setHasError(true);
    const error = e.target.error;
    let message = 'Failed to load video';
    
    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          message = 'Video loading was aborted';
          break;
        case error.MEDIA_ERR_NETWORK:
          message = 'Network error while loading video';
          break;
        case error.MEDIA_ERR_DECODE:
          message = 'Video format not supported';
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          message = 'Video source not supported or not accessible';
          break;
        default:
          message = 'Unknown video error';
      }
    }
    
    setErrorMessage(message);
    console.error('Video error:', error, message);
  };

  const handleRetry = () => {
    setHasError(false);
    setErrorMessage('');
    setIsLoading(true);
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  const handleOpenInNewTab = () => {
    console.log('Attempting to open URLs:');
    console.log('Direct URL:', directUrl);
    console.log('Processed URL:', processedVideoUrl);
    console.log('Original URL:', videoUrl);
    
    // Try different URL formats
    const urlsToTry = [
      directUrl,
      processedVideoUrl,
      videoUrl
    ].filter(url => url && url.trim() !== '');
    
    if (urlsToTry.length === 0) {
      alert('No valid video URL available');
      return;
    }
    
    // Try the first valid URL
    const urlToOpen = urlsToTry[0];
    console.log('Opening URL:', urlToOpen);
    
    try {
      // Create a temporary link and click it
      const link = document.createElement('a');
      link.href = urlToOpen;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error opening URL:', error);
      // Fallback to window.open
      try {
        window.open(urlToOpen, '_blank', 'noopener,noreferrer');
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
        // Last resort - copy to clipboard
        navigator.clipboard?.writeText(urlToOpen).then(() => {
          alert(`URL copied to clipboard: ${urlToOpen}`);
        }).catch(() => {
          alert(`Please copy this URL manually: ${urlToOpen}`);
        });
      }
    }
  };

  const handleTryAlternativeUrl = () => {
    const urlsToTry = [
      directUrl,
      processedVideoUrl,
      videoUrl
    ].filter(url => url && url.trim() !== '');
    
    if (urlsToTry.length > 1) {
      // Try the next URL format
      const currentIndex = urlsToTry.indexOf(processedVideoUrl);
      const nextIndex = (currentIndex + 1) % urlsToTry.length;
      const nextUrl = urlsToTry[nextIndex];
      
      console.log('Trying alternative URL:', nextUrl);
      setProcessedVideoUrl(nextUrl);
      handleRetry();
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-6xl bg-black rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Video Player Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg truncate">{filename}</h3>
                <p className="text-gray-300 text-sm">Ford Service Video Analysis</p>
                {processedVideoUrl && (
                  <p className="text-gray-400 text-xs truncate mt-1">
                    Current URL: {processedVideoUrl}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-all duration-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Video Container */}
          <div className="relative aspect-video bg-black">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="text-center">
                  <motion.div
                    className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full mx-auto mb-4"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <p className="text-white">Loading video...</p>
                  <p className="text-gray-400 text-sm mt-2 break-all px-4">
                    {processedVideoUrl}
                  </p>
                </div>
              </div>
            )}

            {hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="text-center max-w-md px-4">
                  <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <p className="text-white mb-2">Failed to load video</p>
                  <p className="text-gray-400 text-sm mb-4">{errorMessage}</p>
                  
                  <div className="bg-gray-800 rounded-lg p-3 mb-4 text-xs">
                    <p className="text-gray-300 mb-2">Available URLs:</p>
                    <div className="space-y-1 text-left">
                      {videoUrl && (
                        <p className="text-blue-400 break-all">Original: {videoUrl}</p>
                      )}
                      {processedVideoUrl && (
                        <p className="text-green-400 break-all">Processed: {processedVideoUrl}</p>
                      )}
                      {directUrl && directUrl !== processedVideoUrl && (
                        <p className="text-yellow-400 break-all">Direct: {directUrl}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleRetry}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Retry Current URL
                    </button>
                    
                    <button
                      onClick={handleTryAlternativeUrl}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                      Try Alternative URL
                    </button>
                    
                    <button
                      onClick={handleOpenInNewTab}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Open in New Tab</span>
                    </button>
                  </div>
                  
                  <div className="mt-4 text-xs text-gray-500">
                    <p>Troubleshooting:</p>
                    <ul className="text-left mt-2 space-y-1">
                      <li>• Check if the video URL is publicly accessible</li>
                      <li>• Verify CORS settings on Google Cloud Storage</li>
                      <li>• Try opening the video in a new tab</li>
                      <li>• Contact admin if issues persist</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {processedVideoUrl && (
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
                onLoadStart={() => {
                  console.log('Video load started');
                  setIsLoading(true);
                }}
                onLoadedMetadata={() => {
                  console.log('Video metadata loaded');
                }}
                onLoadedData={() => {
                  console.log('Video data loaded');
                  setIsLoading(false);
                  setDuration(videoRef.current?.duration || 0);
                }}
                onCanPlay={() => {
                  console.log('Video can play');
                  setIsLoading(false);
                }}
                onTimeUpdate={() => {
                  setCurrentTime(videoRef.current?.currentTime || 0);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={handleVideoError}
                onEnded={() => setIsPlaying(false)}
                controls={false}
                preload="metadata"
              >
                <source src={processedVideoUrl} type="video/mp4" />
                <source src={processedVideoUrl} type="video/webm" />
                <source src={processedVideoUrl} type="video/quicktime" />
                Your browser does not support the video tag.
              </video>
            )}

            {/* Play/Pause Overlay */}
            {!isLoading && !hasError && (
              <div 
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                onClick={handlePlayPause}
              >
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: isPlaying ? 0 : 1, 
                    opacity: isPlaying ? 0 : 1 
                  }}
                  transition={{ duration: 0.2 }}
                  className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm"
                >
                  <Play className="h-8 w-8 text-white ml-1" />
                </motion.div>
              </div>
            )}
          </div>

          {/* Video Controls */}
          {!isLoading && !hasError && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
              {/* Progress Bar */}
              <div className="mb-4">
                <input
                  type="range"
                  min="0"
                  max={duration}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, #4b5563 ${(currentTime / duration) * 100}%, #4b5563 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-300 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handlePlayPause}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>

                  <button
                    onClick={handleRestart}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleMuteToggle}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
                    >
                      {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleFullscreen}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
                  >
                    <Maximize className="h-5 w-5" />
                  </button>

                  <button
                    onClick={handleOpenInNewTab}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
                    title="Open video in new tab"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Helper function to get status icon and color
const getStatusDisplay = (value, type = 'yesno') => {
  if (type === 'yesno') {
    if (value === 'Yes') {
      return { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' };
    } else if (value === 'No') {
      return { icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/30' };
    }
  } else if (type === 'score') {
    const score = parseFloat(value?.toString().replace('%', '') || '0');
    if (score >= 80) {
      return { icon: Award, color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' };
    } else if (score >= 60) {
      return { icon: TrendingUp, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/30' };
    } else {
      return { icon: AlertCircle, color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/30' };
    }
  }
  return { icon: Info, color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30' };
};

// Enhanced Login Component (keeping the same as before)
const LoginScreen = ({ setAuthenticated }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setIsLoading(true);
    setError('');
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if ((username === 'admin' && password === 'admin') || 
        (username === 'user' && password === 'user')) {
      localStorage.setItem('GenAi', JSON.stringify({
        authenticated: true,
        user: username === 'admin' ? 'Admin' : 'User'
      }));
      setAuthenticated(true);
    } else {
      setError('Invalid credentials. Try admin/admin or user/user');
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
            animate={{
              x: [0, Math.random() * 200 - 100],
              y: [0, Math.random() * 200 - 100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 20 + 10,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Left Section - Branding */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 flex items-center justify-center p-12"
        >
          <div className="max-w-lg">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mb-8"
            >
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/25">
                <Brain className="h-10 w-10 text-white" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <h1 className="text-6xl font-bold mb-4">
                <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
                  Vehicle
                </span>
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                   EVHC
                </span>
              </h1>
              
              <h2 className="text-3xl font-bold text-white mb-6">
                Video Service Analysis
              </h2>
              
              <p className="text-gray-300 text-lg leading-relaxed mb-8">
                Advanced AI-powered video analysis for Vehicle Service Operations. 
                Revolutionizing automotive service through intelligent insights.
              </p>

              <div className="flex items-center justify-center space-x-6 text-sm text-gray-400">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-green-400" />
                  <span>Secure</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-blue-400" />
                  <span>Global</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span>AI Powered</span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Right Section - Login Form */}
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[500px] flex items-center justify-center p-12"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-md"
          >
            {/* Login Card */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
              {/* Header */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                >
                  <User className="h-6 w-6 text-white" />
                </motion.div>
                
                <h3 className="text-2xl font-bold text-white mb-2">Welcome Back</h3>
                <p className="text-gray-300">Sign in to access the AI EVHC Video Analyzer</p>
              </div>

              {/* Form */}
              <div className="space-y-6">
                {/* Username Field */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Enter username"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>
                </motion.div>

                {/* Password Field */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Enter password"
                      className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </motion.div>

                {/* Error Message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Login Button */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  onClick={handleLogin}
                  disabled={isLoading || !username || !password}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? (
                    <>
                      <motion.div
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5" />
                      <span>Sign In</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-8 text-center"
            >
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-400">
                <div className="w-16 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center font-bold text-white text-xs">
                  <Car className="h-4 w-4" />
                </div>
                <span>×</span>
                <div className="text-gray-300 font-medium">Cloud Powered</div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

// Enhanced Main Application
const MainApplication = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoData, setVideoData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');
  const [citNowUrl, setCitNowUrl] = useState('');

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      console.log('=== LOADING DATA START ===');
      
      const [filesRes, videoRes] = await Promise.all([
        apiService.getFiles(),
        apiService.getVideoData()
      ]);
      
      console.log('Raw files response:', filesRes);
      console.log('Raw video response:', videoRes);
      
      const newFiles = filesRes || [];
      const newVideoData = videoRes?.data || [];
      
      console.log('Processed files:', newFiles);
      console.log('Processed video data:', newVideoData);
      
      console.log('Files count:', newFiles.length);
      console.log('Video data count:', newVideoData.length);
      
      // Log the filenames to see what's actually there
      if (newFiles.length > 0) {
        console.log('File names:', newFiles.map(f => f.file_name));
      }
      
      if (newVideoData.length > 0) {
        console.log('Video data filenames:', newVideoData.map(v => v.filename));
      }
      
      setFiles(newFiles);
      setVideoData(newVideoData);
      
      console.log('=== LOADING DATA COMPLETE ===');
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  

  const handleFileSelect = async (file) => {
    try {
      setSelectedFile(file);
      setIsLoading(true);
      const response = await apiService.getSingleRecord(file.file_name);
      setSummary(response.summary || []);
    } catch (error) {
      console.error('Error:', error);
      setSummary([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 FIXED CODE - This is the main change!
  // 🔥 FIXED CODE - Updated handleFileUpload function with null safety
  const handleFileUpload = async (uploadData) => {
    try {
      setIsUploading(true);
      console.log('📤 Upload data being sent:', uploadData);
      
      // Call the API and get immediate response
      const response = await apiService.analyzeVideo(uploadData);
      console.log('📥 API Response received:', response);
      
      // ✅ CORRECT PATTERN: Show results immediately from API response
      if (response) {
        // Extract filename from response
        let filename = null;
        if (response?.filename) {
          filename = response.filename;
        } else if (response?.[0]?.filename) {
          filename = response[0].filename;
        } else if (uploadData.file?.name) {
          filename = uploadData.file.name;
        } else if (uploadData.embedded_url) {
          filename = 'output-1200k.mp4';
        } else if (uploadData.url) {
          const urlParts = uploadData.url.split('/');
          filename = urlParts[urlParts.length - 1];
          if (uploadData.url_type === 'youtube') {
            filename = 'youtube_video.mp4';
          }
        } else {
          filename = 'processed_video.mp4'; // fallback
        }
        
        console.log('🎯 Using filename:', filename);
        
        // Create file object for immediate display
        const newFile = {
          file_name: filename,
          public_url: response.video_url || response.url || '#'
        };
        
        // ✅ IMMEDIATELY show results from API response
        setSelectedFile(newFile);
        console.log('🎯 DISPLAYING RESULTS immediately for:', filename);
        
        // Extract and set analysis results from response
        let analysisResults = null;
        
        // Try different response structures
        if (response.analysis) {
          analysisResults = response.analysis;
        } else if (response.data) {
          analysisResults = response.data;
        } else if (response.summary || response.percentage || response.car_type) {
          // Response itself contains the analysis
          analysisResults = response;
        }
        
        if (analysisResults) {
          // Add to videoData for immediate display
          const videoRecord = {
            filename: filename,
            ...analysisResults
          };
          
          // Update videoData to include this new record
          setVideoData(prevData => {
            const filtered = prevData.filter(v => v.filename !== filename);
            return [...filtered, videoRecord];
          });
          
          // Set summary if available
          if (analysisResults.summary) {
            const summaryData = Array.isArray(analysisResults.summary) 
              ? analysisResults.summary 
              : [analysisResults.summary];
            setSummary(summaryData);
            console.log('📋 Summary set from API response');
          } else {
            setSummary(['Analysis completed. Detailed results are now available.']);
            console.log('📋 Default summary set');
          }
          
          console.log('🎉 ANALYSIS RESULTS DISPLAYED IMMEDIATELY');
        } else {
          console.log('⚠️ No analysis data in response, setting basic summary');
          setSummary(['Video uploaded and processed successfully. Analysis results will appear shortly.']);
        }
        
        // ✅ THEN refresh file list in background (don't wait for this)
        setTimeout(async () => {
          console.log('🔄 Refreshing file list in background...');
          try {
            await loadData();
            console.log('📁 Background file list refresh completed');
            
            // After background refresh, try to get more complete data
            const updatedVideoData = (await apiService.getVideoData())?.data || [];
            const updatedRecord = updatedVideoData.find(v => v.filename === filename);
            
            if (updatedRecord && updatedRecord.summary && !analysisResults?.summary) {
              // Update summary with more complete data if available
              const summaryData = Array.isArray(updatedRecord.summary) 
                ? updatedRecord.summary 
                : [updatedRecord.summary];
              setSummary(summaryData);
              console.log('📋 Summary updated from background refresh');
            }
          } catch (error) {
            console.error('Background refresh failed:', error);
          }
        }, 2000); // Refresh after 2 seconds in background
        
      } else {
        console.warn('⚠️ No response data received from API');
        throw new Error('No response data received');
      }
      
      return response;
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };
  
  


  const handleDeleteFile = async (filename) => {
    try {
      await apiService.deleteFile(filename);
      setFiles(prev => prev.filter(f => f.file_name !== filename));
      setVideoData(prev => prev.filter(v => v.filename !== filename));
      if (selectedFile?.file_name === filename) {
        setSelectedFile(null);
        setSummary(null);
      }
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('GenAi');
    window.location.reload();
  };

  const handleWatchVideo = (videoUrl) => {
    setCurrentVideoUrl(videoUrl);
    setIsVideoPlayerOpen(true);
  };

  const filteredFiles = files.filter(file => 
    file.file_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get current record for selected file
  const currentRecord = selectedFile ? 
    videoData.find(v => v.filename === selectedFile.file_name) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent)]"></div>
      
      <div className="relative z-10">
        {/* Enhanced Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-xl bg-black/20 border-b border-white/10 sticky top-0 z-50"
        >
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <motion.div 
                className="flex items-center space-x-4"
                whileHover={{ scale: 1.02 }}
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <Brain className="h-7 w-7 text-white" />
                  </div>
                  <motion.div
                    className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-slate-900"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                
                <div>
                  <h1 className="text-3xl font-bold">
                    <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
                      AI EVHC VIDEO ANALYZER
                    </span>
                  </h1>
                  <p className="text-sm text-gray-400 font-medium">
                    Advanced Service Video Intelligence
                  </p>
                </div>
              </motion.div>

              <div className="flex items-center space-x-4">
                <motion.div 
                  className="flex items-center space-x-2 bg-green-500/20 px-3 py-2 rounded-full border border-green-500/30"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-sm font-medium">Live Analysis</span>
                </motion.div>

                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-all duration-200"
                >
                  Logout
                </button>

                <motion.div 
                  className="w-16 h-10 bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-lg"
                  whileHover={{ scale: 1.05 }}
                >
                  <Car className="h-5 w-5" />
                </motion.div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Main Content */}
        <main className="flex h-[calc(100vh-88px)]">
          {/* Sidebar */}
          <div className="w-80 backdrop-blur-xl bg-white/5 border-r border-white/10 flex flex-col">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Video Files</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={loadData}
                    disabled={isLoading}
                    className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 transition-all duration-200"
                  >
                    <RefreshCw className={`h-4 w-4 text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  
                  {selectedFile && (
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setSummary(null);
                      }}
                      className="p-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/30 transition-all duration-200"
                    >
                      <ArrowLeft className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search videos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                />
              </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto p-4 space-y-2">
                {filteredFiles.map((file, index) => (
                  <motion.div
                    key={file.public_url}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => handleFileSelect(file)}
                    className={`group p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedFile?.file_name === file.file_name
                        ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 shadow-lg shadow-blue-500/10'
                        : 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <FileVideo className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {file.file_name?.split('.')[0] || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-400">
                          .{file.file_name?.split('.').pop() || 'unknown'}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Delete this file?')) {
                            handleDeleteFile(file.file_name);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}

                {filteredFiles.length === 0 && (
                  <div className="text-center py-12">
                    <FileVideo className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400">No videos found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Button */}
            <div className="p-6 border-t border-white/10">
              <button
                onClick={() => setIsUploadOpen(true)}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Upload className="h-5 w-5" />
                <span>Upload Video</span>
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Content Header */}
            <div className="p-6 border-b border-white/10 backdrop-blur-xl bg-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {selectedFile ? 'Video Analysis' : 'Dashboard Overview'}
                  </h2>
                  <p className="text-gray-400">
                    {selectedFile 
                      ? `Analyzing: ${selectedFile.file_name}`
                      : 'Comprehensive video analysis results and insights'
                    }
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    if (videoData.length > 0) {
                      // Prepare data for Excel export
                      const exportData = videoData.map(record => ({
                        'Filename': record.filename || '',
                        'Car Type': record.car_type || '',
                        'Service Related Video': record.service_related_video || '',
                        'Sound & Image': record.sound_and_image || '',
                        'License Plate Visible': record.show_license_plate || '',
                        'Car on Ramp': record.car_on_ramp || '',
                        'Technician/Advisor Name': record.service_advisor_or_technician_name || '',
                        'Dealership Name': record.DealershipName || '',
                        'Customer Name': record.customer_name || '',
                        'Special Tools - Tyres': record.special_tools_tyres || '',
                        'Special Tools - Brake Pad': record.special_tools_brake_pad || '',
                        'Special Tools - Disc': record.Special_tools_disc || '',
                        'Offer Mentioned': record.attached_offer_mentioned || '',
                        'Correct Ending': record.correct_ending || '',
                        'License Plate Score': record.show_license_plate_eval || '',
                        'Car on Ramp Score': record.car_on_ramp_eval || '',
                        'Technician Name Score': record.service_advisor_or_technician_name_eval || '',
                        'Dealership Score': record.DealershipName_eval || '',
                        'Customer Name Score': record.customer_name_eval || '',
                        'Tyre Tools Score': record.special_tools_tyres_eval || '',
                        'Brake Pad Tools Score': record.special_tools_brake_pad_eval || '',
                        'Disc Tools Score': record.Special_tools_disc_eval || '',
                        'Offer Mentioned Score': record.attached_offer_mentioned_eval || '',
                        'Approve Offer Score': record.approve_offer_mentioned_eval || '',
                        'Correct Ending Score': record.correct_ending_eval || '',
                        'Total Points': record.total_points_eval || '',
                        'Percentage': record.percentage || '',
                        'Battery Check': record.battery_checked_eval || '',
                        'Windscreen Check': record.wind_screen_checked_eval || '',
                        'Summary': record.summary || '',
                        'Video URL': record.video_url || ''
                      }));

                      // Create a new workbook
                      const workbook = XLSX.utils.book_new();
                      
                      // Convert data to worksheet
                      const worksheet = XLSX.utils.json_to_sheet(exportData);
                      
                      // Set column widths for better readability
                      const columnWidths = [
                        { wch: 30 }, // Filename
                        { wch: 15 }, // Car Type
                        { wch: 20 }, // Service Related Video
                        { wch: 15 }, // Sound & Image
                        { wch: 20 }, // License Plate Visible
                        { wch: 15 }, // Car on Ramp
                        { wch: 25 }, // Technician/Advisor Name
                        { wch: 20 }, // Dealership Name
                        { wch: 20 }, // Customer Name
                        { wch: 20 }, // Special Tools - Tyres
                        { wch: 25 }, // Special Tools - Brake Pad
                        { wch: 20 }, // Special Tools - Disc
                        { wch: 18 }, // Offer Mentioned
                        { wch: 15 }, // Correct Ending
                        { wch: 18 }, // License Plate Score
                        { wch: 18 }, // Car on Ramp Score
                        { wch: 20 }, // Technician Name Score
                        { wch: 18 }, // Dealership Score
                        { wch: 20 }, // Customer Name Score
                        { wch: 18 }, // Tyre Tools Score
                        { wch: 22 }, // Brake Pad Tools Score
                        { wch: 18 }, // Disc Tools Score
                        { wch: 22 }, // Offer Mentioned Score
                        { wch: 20 }, // Approve Offer Score
                        { wch: 20 }, // Correct Ending Score
                        { wch: 15 }, // Total Points
                        { wch: 12 }, // Percentage
                        { wch: 15 }, // Battery Check
                        { wch: 18 }, // Windscreen Check
                        { wch: 50 }, // Summary
                        { wch: 40 }  // Video URL
                      ];
                      
                      worksheet['!cols'] = columnWidths;
                      
                      // Add worksheet to workbook
                      XLSX.utils.book_append_sheet(workbook, worksheet, 'Video Analysis Data');
                      
                      // Generate filename with current date
                      const now = new Date();
                      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
                      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
                      const filename = `Ford_Video_Analysis_${dateStr}_${timeStr}.xlsx`;
                      
                      // Download the file
                      XLSX.writeFile(workbook, filename);
                    } else {
                      alert('No data available to export');
                    }
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded-lg text-green-400 transition-all duration-200"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Data</span>
                </button>

                
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-auto p-6">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center h-full"
                  >
                    <div className="text-center">
                      <motion.div
                        className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full mx-auto mb-4"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      <p className="text-gray-400 text-lg">Analyzing video content...</p>
                    </div>
                  </motion.div>
                ) : !selectedFile ? (
                  // Dashboard View
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-400 text-sm font-medium">Total Videos</p>
                            <p className="text-3xl font-bold text-white mt-2">{files.length}</p>
                          </div>
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                            <FileVideo className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-400 text-sm font-medium">Analyzed</p>
                            <p className="text-3xl font-bold text-white mt-2">{videoData.length}</p>
                          </div>
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                            <BarChart3 className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-400 text-sm font-medium">Avg Score</p>
                            <p className="text-3xl font-bold text-white mt-2">
                              {videoData.length > 0 
                                ? Math.round(videoData
                                    .filter(v => v.percentage)
                                    .reduce((acc, v) => acc + parseFloat(v.percentage.replace('%', '')), 0) 
                                    / videoData.filter(v => v.percentage).length) + '%'
                                : '0%'
                              }
                            </p>
                          </div>
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <Sparkles className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                      <h3 className="text-xl font-bold text-white mb-4">Recent Files</h3>
                      <div className="space-y-3">
                        {files.slice(0, 5).map((file, index) => (
                          <div 
                            key={file.file_name} 
                            className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                            onClick={() => handleFileSelect(file)}
                          >
                            <div className="flex items-center space-x-3">
                              <FileVideo className="h-5 w-5 text-blue-400" />
                              <span className="text-white font-medium">{file.file_name}</span>
                            </div>
                            <span className="text-green-400 text-sm">Ready</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  // File Analysis View
                  <motion.div
                    key="analysis"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Summary Section */}
                    {summary && summary.length > 0 && (
                      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                          <Sparkles className="h-5 w-5 mr-2 text-blue-400" />
                          AI Generated Summary
                        </h3>
                        <div className="space-y-3">
                          {summary.map((paragraph, index) => (
                            <p key={index} className="text-gray-300 leading-relaxed">
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Video Info Card */}
                    {currentRecord && (
                      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold text-white flex items-center">
                            <FileVideo className="h-5 w-5 mr-2 text-blue-400" />
                            Video Information
                          </h3>
                          {currentRecord.video_url && (
                            <a
                              href={currentRecord.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded-lg text-blue-400 transition-all duration-200"
                            >
                              <Play className="h-4 w-4" />
                              <span>Watch Video</span>
                            </a>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-gray-400 text-sm mb-2">Car Type</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${
                              currentRecord.car_type === 'Non Ford' 
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            }`}>
                              {currentRecord.car_type || 'Unknown'}
                            </span>
                          </div>

                          <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-gray-400 text-sm mb-2">Overall Score</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${
                              parseFloat(currentRecord.percentage?.replace('%', '') || '0') >= 80 
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : parseFloat(currentRecord.percentage?.replace('%', '') || '0') >= 60
                                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                : 'bg-red-500/20 text-red-400 border-red-500/30'
                            }`}>
                              {currentRecord.percentage || 'N/A'}
                            </span>
                          </div>

                          <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-gray-400 text-sm mb-2">Total Points</p>
                            <p className="text-white font-bold text-lg">
                              {currentRecord.total_points_eval || 'N/A'}
                            </p>
                          </div>

                          <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-gray-400 text-sm mb-2">Service Video</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${
                              currentRecord.service_related_video === 'Yes'
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            }`}>
                              {currentRecord.service_related_video || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Detailed Evaluation */}
                    {currentRecord && (
                      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-white/10">
                          <h3 className="text-xl font-bold text-white flex items-center">
                            <BarChart3 className="h-5 w-5 mr-2 text-purple-400" />
                            Detailed Evaluation Metrics
                          </h3>
                        </div>
                        
                        <div className="p-6 space-y-6">
                          {/* Basic Assessment */}
                          <div>
                            <h4 className="text-lg font-semibold text-white mb-4 text-blue-400">Basic Assessment</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">Sound & Image</p>
                                    <p className="text-white font-medium">{currentRecord.sound_and_image || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.sound_and_image);
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>

                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">License Plate Visible</p>
                                    <p className="text-white font-medium">{currentRecord.show_license_plate || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.show_license_plate);
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>

                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">Car on Ramp</p>
                                    <p className="text-white font-medium">{currentRecord.car_on_ramp || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.car_on_ramp);
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Personnel & Customer Info */}
                          <div>
                            <h4 className="text-lg font-semibold text-white mb-4 text-green-400">Personnel & Customer</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">Technician/Advisor Name</p>
                                    <p className="text-white font-medium">{currentRecord.service_advisor_or_technician_name || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.service_advisor_or_technician_name);
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>

                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">Customer Name</p>
                                    <p className="text-white font-medium">{currentRecord.customer_name || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.customer_name);
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>

                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">Dealership Name</p>
                                    <p className="text-white font-medium">{currentRecord.DealershipName || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.DealershipName);
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Special Tools */}
                          <div>
                            <h4 className="text-lg font-semibold text-white mb-4 text-purple-400">Special Tools Usage</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">Tyre Tools</p>
                                    <p className="text-white font-medium">{currentRecord.special_tools_tyres || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.special_tools_tyres);
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>

                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">Brake Pad Tools</p>
                                    <p className="text-white font-medium">{currentRecord.special_tools_brake_pad || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.special_tools_brake_pad);
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>

                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">Disc Tools</p>
                                    <p className="text-white font-medium">{currentRecord.Special_tools_disc || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.Special_tools_disc);
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Service Completion */}
                          <div>
                            <h4 className="text-lg font-semibold text-white mb-4 text-yellow-400">Service Completion</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">Offer Mentioned</p>
                                    <p className="text-white font-medium">{currentRecord.attached_offer_mentioned || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.attached_offer_mentioned);
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>

                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">Correct Ending</p>
                                    <p className="text-white font-medium">{currentRecord.correct_ending || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.correct_ending);
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Additional Checks */}
                          <div>
                            <h4 className="text-lg font-semibold text-white mb-4 text-cyan-400">Additional System Checks</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">Battery Check</p>
                                    <p className="text-white font-medium">{currentRecord.battery_checked_eval || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.battery_checked_eval, 'score');
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>

                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-gray-400 text-sm">Windscreen Check</p>
                                    <p className="text-white font-medium">{currentRecord.wind_screen_checked_eval || 'N/A'}</p>
                                  </div>
                                  {(() => {
                                    const { icon: Icon, color } = getStatusDisplay(currentRecord.wind_screen_checked_eval, 'score');
                                    return <Icon className={`h-5 w-5 ${color}`} />;
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Scoring Breakdown */}
                          <div>
                            <h4 className="text-lg font-semibold text-white mb-4 text-orange-400">Scoring Breakdown</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                                <p className="text-gray-400 text-xs">License Plate</p>
                                <p className="text-white font-bold text-lg">{currentRecord.show_license_plate_eval || '0'}</p>
                                <p className="text-gray-500 text-xs">/ 5</p>
                              </div>

                              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                                <p className="text-gray-400 text-xs">Car on Ramp</p>
                                <p className="text-white font-bold text-lg">{currentRecord.car_on_ramp_eval || '0'}</p>
                                <p className="text-gray-500 text-xs">/ 5</p>
                              </div>

                              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                                <p className="text-gray-400 text-xs">Technician Name</p>
                                <p className="text-white font-bold text-lg">{currentRecord.service_advisor_or_technician_name_eval || '0'}</p>
                                <p className="text-gray-500 text-xs">/ 10</p>
                              </div>

                              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                                <p className="text-gray-400 text-xs">Dealership</p>
                                <p className="text-white font-bold text-lg">{currentRecord.DealershipName_eval || '0'}</p>
                                <p className="text-gray-500 text-xs">/ 1</p>
                              </div>

                              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                                <p className="text-gray-400 text-xs">Customer Name</p>
                                <p className="text-white font-bold text-lg">{currentRecord.customer_name_eval || '0'}</p>
                                <p className="text-gray-500 text-xs">/ 1</p>
                              </div>

                              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                                <p className="text-gray-400 text-xs">Tyre Tools</p>
                                <p className="text-white font-bold text-lg">{currentRecord.special_tools_tyres_eval || '0'}</p>
                                <p className="text-gray-500 text-xs">/ 20</p>
                              </div>

                              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                                <p className="text-gray-400 text-xs">Brake Tools</p>
                                <p className="text-white font-bold text-lg">{currentRecord.special_tools_brake_pad_eval || '0'}</p>
                                <p className="text-gray-500 text-xs">/ 20</p>
                              </div>

                              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                                <p className="text-gray-400 text-xs">Disc Tools</p>
                                <p className="text-white font-bold text-lg">{currentRecord.Special_tools_disc_eval || '0'}</p>
                                <p className="text-gray-500 text-xs">/ 20</p>
                              </div>

                              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                                <p className="text-gray-400 text-xs">Offer Mentioned</p>
                                <p className="text-white font-bold text-lg">{currentRecord.attached_offer_mentioned_eval || '0'}</p>
                                <p className="text-gray-500 text-xs">/ 10</p>
                              </div>

                              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                                <p className="text-gray-400 text-xs">Approve Offer</p>
                                <p className="text-white font-bold text-lg">{currentRecord.approve_offer_mentioned_eval || '0'}</p>
                                <p className="text-gray-500 text-xs">/ 10</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>

      {/* Video Player Modal */}
      <VideoPlayerModal
        isOpen={isVideoPlayerOpen}
        onClose={() => setIsVideoPlayerOpen(false)}
        videoUrl={currentVideoUrl}
        filename={selectedFile?.file_name || 'Video'}
      />

      {/* Upload Modal */}
      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsUploadOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Upload Video</h3>
                <button
                  onClick={() => {
                    setIsUploadOpen(false);
                    setUploadUrl('');
                    setCitNowUrl('');
                  }}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Option 1: Upload File
                  </label>
                  <div className="border-2 border-dashed border-gray-600 hover:border-gray-500 rounded-lg p-6 text-center cursor-pointer transition-all">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          try {
                            console.log('Starting file upload...');
                            
                            await handleFileUpload({ file: e.target.files[0] });
                            
                            console.log('File upload successful, closing modal...');
                            
                            setIsUploadOpen(false);
                            e.target.value = ''; // Reset file input
                            
                            console.log('Upload process completed successfully');
                            
                          } catch (error) {
                            console.error('Upload failed:', error);
                            alert('Upload failed: ' + (error?.response?.data?.detail || error?.message || 'Unknown error'));
                          }
                        }
                      }}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Click to select video file</p>
                      <p className="text-xs text-gray-500 mt-1">MP4, AVI, MKV supported</p>
                    </label>
                  </div>
                </div>

                {/* GCS URL Input - FIXED WITH YOUTUBE SUPPORT */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Option 2: Enter GCS URL or YouTube Link
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="gs://bucket-name/video.mp4 or https://youtube.com/watch?v=..."
                      value={uploadUrl || ''}
                      onChange={(e) => setUploadUrl(e.target.value || '')}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                  </div>
                  
                  {/* Helper text */}
                  <div className="mt-2 text-xs text-gray-400">
                    <p>Supported formats:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>📁 Google Cloud Storage: gs://bucket-name/path/to/video.mp4</li>
                      <li>🎥 YouTube: https://www.youtube.com/watch?v=VIDEO_ID</li>
                      <li>🎥 YouTube: https://youtu.be/VIDEO_ID</li>
                    </ul>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        // Helper function to validate YouTube URLs
                        function isYouTubeUrl(url) {
                          if (!url || typeof url !== 'string') return false;
                          
                          const youtubePatterns = [
                            /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+(&.*)?$/i,
                            /^https?:\/\/(www\.)?youtu\.be\/[\w-]+([\?&].*)?$/i,
                            /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+(\?.*)?$/i,
                            /^https?:\/\/(www\.)?youtube\.com\/v\/[\w-]+(\?.*)?$/i,
                            /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+(\?.*)?$/i,
                            /^https?:\/\/(m\.)?youtube\.com\/watch\?v=[\w-]+(&.*)?$/i
                          ];
                          
                          return youtubePatterns.some(pattern => pattern.test(url));
                        }

                        // Validation function
                        function validateUploadUrl(url) {
                          const trimmedUrl = (url || '').toString().trim();
                          
                          if (!trimmedUrl) {
                            return { valid: false, message: 'Please enter a URL', type: null };
                          }
                          
                          if (trimmedUrl.startsWith('gs://')) {
                            return { valid: true, type: 'gcs', message: 'Valid GCS URL' };
                          }
                          
                          if (isYouTubeUrl(trimmedUrl)) {
                            return { valid: true, type: 'youtube', message: 'Valid YouTube URL' };
                          }
                          
                          return { 
                            valid: false, 
                            type: null,
                            message: `Invalid URL format!\n\nSupported formats:\n\n📁 Google Cloud Storage:\n• gs://bucket-name/path/to/video.mp4\n\n🎥 YouTube:\n• https://www.youtube.com/watch?v=VIDEO_ID\n• https://youtu.be/VIDEO_ID\n• https://youtube.com/watch?v=VIDEO_ID\n\nYour input: ${trimmedUrl}`
                          };
                        }

                        // Validate the URL
                        const validation = validateUploadUrl(uploadUrl);
                        
                        if (!validation.valid) {
                          alert(validation.message);
                          return;
                        }
                        
                        console.log(`🚀 Starting ${validation.type} upload...`);
                        
                        // Prepare upload data
                        const uploadData = {
                          url: (uploadUrl || '').trim(),
                          url_type: validation.type
                        };
                        
                        // ✅ FIXED: Don't close modal immediately, wait for results
                        const response = await handleFileUpload(uploadData);
                        
                        console.log(`✅ ${validation.type} upload completed successfully`);
                        
                        // Clear the URL but keep modal open until we confirm results are showing
                        setUploadUrl('');
                        
                        // ✅ FIXED: Only close modal after a longer delay to ensure results are visible
                        setTimeout(() => {
                          console.log('🎯 Closing modal after results are displayed');
                          setIsUploadOpen(false);
                        }, 2000); // Wait 2 seconds to ensure results are fully loaded and displayed
                        
                      } catch (error) {
                        console.error('Upload failed:', error);
                        alert('Upload failed: ' + (error?.response?.data?.detail || error?.message || 'Unknown error'));
                      }
                    }}
                    disabled={isUploading || !(uploadUrl || '').trim()}
                    className="w-full mt-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center space-x-2"
                  >
                    {isUploading ? (
                      <>
                        <motion.div
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        <span>Processing {uploadUrl && uploadUrl.includes('youtube') ? 'YouTube' : 'GCS'} URL...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>Process URL</span>
                      </>
                    )}
                  </button>

                </div>

                {/* CitNow Video URL Input - FIXED */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Option 3: Enter CitNow Video URL
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="https://citnow.com/video/..."
                      value={citNowUrl || ''}
                      onChange={(e) => setCitNowUrl(e.target.value || '')}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 transition-all"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        // Safe string conversion and trimming
                        const safeCitNowUrl = (citNowUrl || '').toString().trim();
                        
                        if (!safeCitNowUrl) {
                          alert('Please enter a CitNow URL');
                          return;
                        }
                        
                        // Basic URL validation for CitNow
                        if (!safeCitNowUrl.includes('citnow.com')) {
                          alert('Please enter a valid CitNow URL');
                          return;
                        }

                        console.log('Starting CitNow video processing...');
                        
                        await handleFileUpload({ 
                          embedded_url: safeCitNowUrl
                        });
                        
                        console.log('CitNow processing successful, closing modal...');
                        
                        setCitNowUrl('');
                        setIsUploadOpen(false);
                        
                        console.log('CitNow process completed');
                        
                      } catch (error) {
                        console.error('CitNow processing failed:', error);
                        alert('CitNow processing failed: ' + (error?.response?.data?.detail || error?.message || 'Unknown error'));
                      }
                    }}
                    disabled={isUploading || !(citNowUrl || '').trim()}
                    className="w-full mt-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center space-x-2"
                  >
                    {isUploading ? (
                      <>
                        <motion.div
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        <span>Processing CitNow...</span>
                      </>
                    ) : (
                      <>
                        <FileVideo className="h-4 w-4" />
                        <span>Process CitNow Video</span>
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Enter a CitNow embedded video URL for automatic extraction and analysis
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

// Main App Component
const App = () => {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('GenAi');
    if (auth) {
      const parsedAuth = JSON.parse(auth);
      setAuthenticated(parsedAuth.authenticated);
    }
  }, []);

  return (
    <div className="App">
      <AnimatePresence mode="wait">
        {authenticated ? (
          <motion.div
            key="main"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5 }}
          >
            <MainApplication />
          </motion.div>
        ) : (
          <motion.div
            key="login"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
          >
            <LoginScreen setAuthenticated={setAuthenticated} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;

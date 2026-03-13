import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Mail, Calendar, Edit2, Save, Camera, Lock, Loader, 
  BookOpen, TrendingUp, Zap, Heart, CheckCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const moodIcons = {
  happy: '😊',
  sad: '😢',
  excited: '🤩',
  calm: '😌',
  angry: '😠',
  anxious: '😰',
  grateful: '🙏',
  neutral: '😐'
};

const Profile = () => {
  const { user, setUser, api, isAuthenticated } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [stats, setStats] = useState({
    totalEntries: 0,
    thisMonth: 0,
    streakDays: 0,
    moodEntries: {},
    totalMoods: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    name: user?.name || user?.username || 'User',
    email: user?.email || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || '',
    avatar: user?.avatar || '',
    joinDate: user?.createdAt ? format(new Date(user.createdAt), 'MMMM yyyy') : 'January 2026'
  });

  // Sync profile data with global user state
  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        username: user.username || prev.username,
        name: user.name || prev.name,
        email: user.email || prev.email,
        bio: user.bio || prev.bio,
        location: user.location || prev.location,
        website: user.website || prev.website,
        avatar: user.avatar || prev.avatar,
        joinDate: user.createdAt ? format(new Date(user.createdAt), 'MMMM yyyy') : prev.joinDate
      }));
    }
  }, [user]);

  // Fetch real stats and activity
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserStats();
      fetchRecentActivity();
    }
  }, [isAuthenticated]);

  // FIXED: Correct streak calculation
  const fetchUserStats = async () => {
    try {
      const response = await api.get('/diary');
      const entries = response.data;
      
      // Calculate total entries (including locked)
      const totalEntries = entries.length;
      
      // Calculate this month's entries (including locked)
      const now = new Date();
      const thisMonth = entries.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate.getMonth() === now.getMonth() && 
               entryDate.getFullYear() === now.getFullYear();
      }).length;
      
      // FIXED: CORRECT STREAK CALCULATION
      const unlockedEntries = entries.filter(entry => !entry.isLocked);
      
      // Get unique entry dates as timestamps for accurate comparison
      const uniqueDates = [...new Set(
        unlockedEntries.map(entry => {
          const d = new Date(entry.date);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })
      )].sort((a, b) => b - a); // Sort descending (newest first)
      
      let streak = 0;
      
      if (uniqueDates.length > 0) {
        let current = new Date(uniqueDates[0]);
        streak = 1; // Count the first day
        
        // Check consecutive days
        for (let i = 1; i < uniqueDates.length; i++) {
          const prev = new Date(uniqueDates[i]);
          const diff = (current - prev) / (1000 * 60 * 60 * 24);
          
          if (diff === 1) {
            streak++;
            current = prev;
          } else {
            break;
          }
        }
      }
      
      // Calculate mood distribution (only unlocked entries)
      const moodCount = {};
      unlockedEntries.forEach(entry => {
        if (entry.mood) {
          moodCount[entry.mood] = (moodCount[entry.mood] || 0) + 1;
        }
      });
      
      const totalMoods = unlockedEntries.length;
      
      setStats({
        totalEntries,
        thisMonth,
        streakDays: streak,
        moodEntries: moodCount,
        totalMoods
      });
      
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const response = await api.get('/diary');
      const entries = response.data;
      
      const recent = entries
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
        .map(entry => ({
          id: entry._id,
          title: entry.title,
          date: entry.date,
          mood: entry.mood,
          isLocked: entry.isLocked
        }));
      
      setRecentActivity(recent);
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveSuccess(false);
    
    try {
      const response = await api.put('/auth/profile', {
        username: profileData.username,
        name: profileData.name,
        email: profileData.email,
        bio: profileData.bio,
        location: profileData.location,
        website: profileData.website
      });

      if (response.data.success) {
        const updatedUser = response.data.user;
        
        // Update global user state
        setUser(updatedUser);
        
        // Update local profile state
        setProfileData(prev => ({
          ...prev,
          username: updatedUser.username,
          name: updatedUser.name,
          email: updatedUser.email,
          bio: updatedUser.bio,
          location: updatedUser.location,
          website: updatedUser.website,
          avatar: updatedUser.avatar || prev.avatar
        }));

        // Save to localStorage
        localStorage.setItem('user', JSON.stringify(updatedUser));

        setSaveSuccess(true);
        toast.success('Profile updated successfully!');
        setIsEditing(false);

        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Image upload that persists after reload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploadingImage(true);
      const response = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Get the image URL from response
      const imageUrl = response.data.url;
      
      // Update avatar in profile via API
      const avatarResponse = await api.post('/auth/upload-avatar', { avatarUrl: imageUrl });
      
      if (avatarResponse.data.success) {
        const updatedUser = avatarResponse.data.user;
        
        // Update local profile state
        setProfileData(prev => ({
          ...prev,
          avatar: updatedUser.avatar
        }));

        // Update global user state
        setUser(updatedUser);

        // Update localStorage
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        toast.success('Profile picture updated!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const entryDate = new Date(date);
    const diffInHours = Math.floor((now - entryDate) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    if (diffInHours < 48) return 'Yesterday';
    return format(entryDate, 'MMM d, yyyy');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gray-50"
    >
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Cover Image */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative h-64 rounded-3xl overflow-hidden mb-20"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600"></div>
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
            <h1 className="text-4xl font-bold mb-2">My Profile</h1>
            <p className="text-white/80">Manage your personal information</p>
          </div>
        </motion.div>

        {/* Profile Picture */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative -mt-32 mb-8 flex justify-center"
        >
          <div className="relative group">
            <div className="w-32 h-32 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 p-1">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                {profileData.avatar ? (
                  <img
                    src={profileData.avatar}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.log('Image failed to load:', profileData.avatar);
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      // Show fallback
                      if (e.target.parentElement) {
                        const fallbackSpan = document.createElement('span');
                        fallbackSpan.className = 'text-4xl text-purple-600';
                        fallbackSpan.textContent = profileData.username?.charAt(0).toUpperCase() || 'U';
                        e.target.parentElement.appendChild(fallbackSpan);
                      }
                    }}
                  />
                ) : (
                  <span className="text-4xl text-purple-600">
                    {profileData.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
            </div>
            {isEditing && (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="profile-image"
                  disabled={uploadingImage}
                />
                <label
                  htmlFor="profile-image"
                  className={`absolute bottom-0 right-0 p-2 bg-purple-600 text-white rounded-full 
                           hover:bg-purple-700 transition-all duration-300 transform hover:scale-110
                           cursor-pointer shadow-lg ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {uploadingImage ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </label>
              </>
            )}
          </div>
        </motion.div>

        {/* Profile Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Stats */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Stats
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5 text-purple-600" />
                    <span className="text-gray-700">Total Entries</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-600">{stats.totalEntries}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <span className="text-gray-700">This Month</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-600">{stats.thisMonth}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-5 w-5 text-purple-600" />
                    <span className="text-gray-700">Streak Days</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-600">{stats.streakDays}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <Heart className="h-5 w-5 text-purple-600" />
                    <span className="text-gray-700">Mood Entries</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-600">{stats.totalMoods}</span>
                </div>
              </div>

              {/* Mood Distribution */}
              {Object.keys(stats.moodEntries).length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Mood Distribution
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(stats.moodEntries).map(([mood, count]) => (
                      <div key={mood} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">{moodIcons[mood] || '😐'}</span>
                          <span className="text-gray-700 capitalize">{mood}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-600 rounded-full"
                              style={{ width: `${stats.totalMoods > 0 ? (count / stats.totalMoods) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Right Column - Personal Info */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-200">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-gray-900">
                  Personal Information
                </h2>
                <button
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  disabled={loading || uploadingImage}
                  className={`flex items-center space-x-2 px-6 py-2 rounded-xl transition-all duration-300 ${
                    isEditing
                      ? saveSuccess
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  } ${(loading || uploadingImage) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : saveSuccess ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Saved!</span>
                    </>
                  ) : isEditing ? (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save</span>
                    </>
                  ) : (
                    <>
                      <Edit2 className="h-4 w-4" />
                      <span>Edit</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        name="username"
                        value={profileData.username}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl 
                                  focus:border-purple-500 focus:ring-2 focus:ring-purple-200 
                                  transition-all duration-300 outline-none
                                  ${!isEditing ? 'bg-gray-50' : 'bg-white'}
                                  border-gray-200 text-gray-900`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Display Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        name="name"
                        value={profileData.name}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl 
                                  focus:border-purple-500 focus:ring-2 focus:ring-purple-200 
                                  transition-all duration-300 outline-none
                                  ${!isEditing ? 'bg-gray-50' : 'bg-white'}
                                  border-gray-200 text-gray-900`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        value={profileData.email}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl 
                                  focus:border-purple-500 focus:ring-2 focus:ring-purple-200 
                                  transition-all duration-300 outline-none
                                  ${!isEditing ? 'bg-gray-50' : 'bg-white'}
                                  border-gray-200 text-gray-900`}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
                    <textarea
                      name="bio"
                      value={profileData.bio}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      rows="4"
                      className={`w-full px-4 py-3 border-2 rounded-xl 
                                focus:border-purple-500 focus:ring-2 focus:ring-purple-200 
                                transition-all duration-300 outline-none resize-none
                                ${!isEditing ? 'bg-gray-50' : 'bg-white'}
                                border-gray-200 text-gray-900`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      name="location"
                      value={profileData.location}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={`w-full px-4 py-3 border-2 rounded-xl 
                                focus:border-purple-500 focus:ring-2 focus:ring-purple-200 
                                transition-all duration-300 outline-none
                                ${!isEditing ? 'bg-gray-50' : 'bg-white'}
                                border-gray-200 text-gray-900`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Website</label>
                    <input
                      type="text"
                      name="website"
                      value={profileData.website}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={`w-full px-4 py-3 border-2 rounded-xl 
                                focus:border-purple-500 focus:ring-2 focus:ring-purple-200 
                                transition-all duration-300 outline-none
                                ${!isEditing ? 'bg-gray-50' : 'bg-white'}
                                border-gray-200 text-gray-900`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Member Since</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={profileData.joinDate}
                        disabled
                        className="w-full pl-12 pr-4 py-3 border-2 rounded-xl 
                                 bg-gray-50 border-gray-200 text-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="password"
                        value="••••••••"
                        disabled
                        className="w-full pl-12 pr-4 py-3 border-2 rounded-xl 
                                 bg-gray-50 border-gray-200 text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="mt-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Recent Activity
                </h2>
                <div className="space-y-4">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity, i) => (
                      <div key={activity.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {activity.isLocked ? (
                              <span className="flex items-center gap-2">
                                <Lock className="h-4 w-4 text-yellow-500" />
                                Locked entry: "{activity.title}"
                              </span>
                            ) : (
                              `Created entry: "${activity.title}"`
                            )}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-sm text-gray-500">
                              {formatTimeAgo(activity.date)}
                            </span>
                            {activity.mood && !activity.isLocked && (
                              <span className="text-sm" title={`Mood: ${activity.mood}`}>
                                {moodIcons[activity.mood]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No recent activity
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default Profile;
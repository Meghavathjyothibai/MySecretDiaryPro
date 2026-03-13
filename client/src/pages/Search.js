import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, Calendar, Tag, Lock, Eye } from 'lucide-react';
import { format } from 'date-fns';
import API from '../services/api';
import toast from 'react-hot-toast';

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

const Search = () => {
  const [entries, setEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMood, setSelectedMood] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [showLocked, setShowLocked] = useState('all'); // 'all', 'locked', 'unlocked'
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('No token found, redirecting to login');
      window.location.href = '/login';
      return;
    }

    try {
      console.log('Search - Fetching entries with token');
      const response = await API.get('/diary');
      console.log('Search entries fetched:', response.data);
      setEntries(response.data);
      
      // Extract all unique tags (including from locked entries)
      const tags = new Set();
      response.data.forEach(entry => {
        if (entry.tags && entry.tags.length > 0) {
          entry.tags.forEach(tag => tags.add(tag));
        }
      });
      setAllTags(['all', ...Array.from(tags)]);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
      } else {
        toast.error('Failed to load entries');
      }
    } finally {
      setLoading(false);
    }
  };

  const filterEntries = () => {
    return entries.filter(entry => {
      // Lock status filter
      if (showLocked === 'locked' && !entry.isLocked) return false;
      if (showLocked === 'unlocked' && entry.isLocked) return false;

      // For locked entries, only show title and basic info in search
      if (entry.isLocked) {
        const matchesSearch = searchTerm === '' || 
          entry.title?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesMood = selectedMood === 'all' || entry.mood === selectedMood;
        
        const matchesTag = selectedTag === 'all' || 
          (entry.tags && entry.tags.includes(selectedTag));

        return matchesSearch && matchesMood && matchesTag;
      }

      // For unlocked entries, full search
      const matchesSearch = searchTerm === '' || 
        entry.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.content?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMood = selectedMood === 'all' || entry.mood === selectedMood;

      const matchesTag = selectedTag === 'all' || 
        (entry.tags && entry.tags.includes(selectedTag));

      return matchesSearch && matchesMood && matchesTag;
    });
  };

  const filteredEntries = filterEntries();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto px-4 py-8"
    >
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-white/20">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">
          Search Entries
        </h1>

        {/* Search Bar */}
        <div className="relative mb-6">
          <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title or content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Mood
            </label>
            <select
              value={selectedMood}
              onChange={(e) => setSelectedMood(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
            >
              <option value="all">All Moods</option>
              {Object.entries(moodIcons).map(([mood, icon]) => (
                <option key={mood} value={mood}>
                  {icon} {mood.charAt(0).toUpperCase() + mood.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Tag
            </label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
            >
              {allTags.map(tag => (
                <option key={tag} value={tag}>
                  {tag === 'all' ? 'All Tags' : `#${tag}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lock Status
            </label>
            <select
              value={showLocked}
              onChange={(e) => setShowLocked(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
            >
              <option value="all">All Entries</option>
              <option value="unlocked">Unlocked Only</option>
              <option value="locked">Locked Only</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-gray-600 mb-4">
          Found {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
        </p>

        {/* Search Results */}
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No entries found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEntries.map((entry) => (
              <motion.div
                key={entry._id}
                whileHover={{ scale: 1.02 }}
                className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden border ${
                  entry.isLocked ? 'border-yellow-200 bg-yellow-50/30' : 'border-purple-100'
                }`}
              >
                <Link to={`/entry/${entry._id}`} className="block p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-800 line-clamp-1 flex items-center gap-2">
                      {entry.isLocked && <Lock className="h-4 w-4 text-yellow-600" />}
                      {entry.title}
                    </h3>
                    {entry.isLocked ? (
                      <span className="text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Locked
                      </span>
                    ) : (
                      <span className="text-2xl">{moodIcons[entry.mood]}</span>
                    )}
                  </div>

                  {entry.isLocked ? (
                    <div className="text-gray-500 text-sm mb-4 italic flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <span>This entry is locked. Click to unlock and view.</span>
                    </div>
                  ) : (
                    <div
                      className="text-gray-600 text-sm mb-4 line-clamp-3"
                      dangerouslySetInnerHTML={{
                        __html: entry.content?.substring(0, 150) + '...'
                      }}
                    />
                  )}

                  <div className="flex items-center text-xs text-gray-500 space-x-3">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(entry.date), 'MMM d, yyyy')}</span>
                    </div>
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <Tag className="h-3 w-3" />
                        <span>{entry.tags.length} tags</span>
                      </div>
                    )}
                  </div>

                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {entry.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            entry.isLocked 
                              ? 'bg-yellow-100 text-yellow-700' 
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          #{tag}
                        </span>
                      ))}
                      {entry.tags.length > 2 && (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          entry.isLocked 
                            ? 'bg-yellow-100 text-yellow-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          +{entry.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Search;
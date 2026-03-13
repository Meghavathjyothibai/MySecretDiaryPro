import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import Calendar from 'react-calendar';
import { motion } from 'framer-motion';
import { BookOpen, Sparkles } from 'lucide-react';
import API from '../services/api';
import toast from 'react-hot-toast';
import 'react-calendar/dist/Calendar.css';

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

const CalendarPage = () => {
  const [entries, setEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntries();
  }, []);

  useEffect(() => {
    if (entries.length > 0) {
      const entriesOnDate = entries.filter(entry =>
        isSameDay(new Date(entry.date), selectedDate)
      );
      setSelectedEntries(entriesOnDate);
    }
  }, [selectedDate, entries]);

  const fetchEntries = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      window.location.href = '/login';
      return;
    }

    try {
      const response = await API.get('/diary');
      // Ensure we have an array
      setEntries(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
      } else {
        toast.error('Failed to load entries');
      }
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  };

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const dayEntries = entries.filter(entry =>
        isSameDay(new Date(entry.date), date)
      );
      
      if (dayEntries.length > 0) {
        const uniqueMoods = [...new Set(dayEntries.map(e => e.mood))];
        
        return (
          <div className="flex flex-col items-center mt-1">
            <div className="flex -space-x-1">
              {uniqueMoods.slice(0, 3).map((mood, idx) => (
                <span key={idx} className="text-xs">
                  {moodIcons[mood] || '📝'}
                </span>
              ))}
            </div>
            {dayEntries.length > 3 && (
              <span className="text-[10px] text-purple-600 font-medium">
                +{dayEntries.length - 3}
              </span>
            )}
          </div>
        );
      }
    }
    return null;
  };

  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const dayEntries = entries.filter(entry =>
        isSameDay(new Date(entry.date), date)
      );
      
      if (dayEntries.length > 0) {
        return 'has-entries';
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-purple-400 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto px-4 py-8 max-w-6xl"
    >
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Diary Calendar
        </h1>
        <p className="text-gray-600 mt-2">Track your journey through time</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Calendar Column */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20"
        >
          <style>{`
            .react-calendar {
              width: 100%;
              border: none;
              background: transparent;
              font-family: inherit;
            }
            .react-calendar__navigation {
              margin-bottom: 1rem;
            }
            .react-calendar__navigation button {
              color: #6b46c1;
              font-weight: 600;
              border-radius: 0.5rem;
              transition: all 0.2s;
            }
            .react-calendar__navigation button:hover {
              background-color: #f3e8ff;
            }
            .react-calendar__month-view__weekdays {
              color: #9ca3af;
              font-weight: 600;
              text-transform: uppercase;
              font-size: 0.75rem;
            }
            .react-calendar__tile {
              padding: 1rem 0.5rem;
              border-radius: 0.75rem;
              transition: all 0.2s;
              position: relative;
            }
            .react-calendar__tile:hover {
              background-color: #f3e8ff;
            }
            .react-calendar__tile--active {
              background: linear-gradient(135deg, #9333ea, #db2777) !important;
              color: white !important;
            }
            .react-calendar__tile--active:hover {
              background: linear-gradient(135deg, #7e22ce, #be185d) !important;
            }
            .react-calendar__tile.has-entries {
              background-color: #faf5ff;
            }
            .react-calendar__tile.has-entries:hover {
              background-color: #f3e8ff;
            }
          `}</style>
          
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            tileContent={tileContent}
            tileClassName={tileClassName}
            className="w-full"
          />
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>Has entries</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full"></div>
                <span>Selected</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Entries Column */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {format(selectedDate, 'MMMM d, yyyy')}
            </h2>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
              {selectedEntries.length} {selectedEntries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {selectedEntries.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="text-6xl mb-4">📅</div>
              <p className="text-gray-500 text-lg mb-4">No entries for this date</p>
              <Link
                to="/create"
                className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg font-medium"
              >
                Write an Entry
              </Link>
            </motion.div>
          ) : (
            <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2">
              {selectedEntries.map((entry, index) => {
                // Safely handle content
                const plainContent = entry.content ? stripHtml(entry.content) : '';
                const displayContent = plainContent.length > 150 
                  ? plainContent.substring(0, 150) + '...' 
                  : plainContent;

                return (
                  <motion.div
                    key={entry._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    className="border border-purple-100 rounded-xl p-4 hover:shadow-md transition-all bg-white"
                  >
                    <Link to={`/entry/${entry._id}`} className="block">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-2xl">{moodIcons[entry.mood] || '📝'}</span>
                            <h3 className="font-semibold text-lg text-gray-800 hover:text-purple-600 transition-colors">
                              {entry.title || 'Untitled'}
                            </h3>
                          </div>
                          
                          {displayContent && (
                            <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                              {displayContent}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">
                                {entry.date ? format(new Date(entry.date), 'h:mm a') : ''}
                              </span>
                              {entry.isLocked && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                  🔒 Locked
                                </span>
                              )}
                            </div>
                            
                            {entry.tags && entry.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {entry.tags.slice(0, 2).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                                {entry.tags.length > 2 && (
                                  <span className="text-xs text-gray-500">
                                    +{entry.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <BookOpen className="h-5 w-5 text-purple-400 ml-4 flex-shrink-0" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Mood Legend */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 pt-6 border-t border-purple-200"
      >
        <h3 className="text-sm font-semibold text-gray-600 mb-3 text-center">Mood Legend</h3>
        <div className="flex flex-wrap justify-center gap-4">
          {Object.entries(moodIcons).map(([mood, icon]) => (
            <div key={mood} className="flex items-center space-x-1 bg-white/50 px-3 py-1 rounded-full">
              <span className="text-sm">{icon}</span>
              <span className="text-sm text-gray-600 capitalize">{mood}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CalendarPage;
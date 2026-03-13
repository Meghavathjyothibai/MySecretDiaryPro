import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Edit, Trash2, Eye, Download, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';

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

// Simple mood text mapping (no special characters)
const moodText = {
  happy: 'Happy',
  sad: 'Sad',
  excited: 'Excited',
  calm: 'Calm',
  angry: 'Angry',
  anxious: 'Anxious',
  grateful: 'Grateful',
  neutral: 'Neutral'
};

const Dashboard = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const { api, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchEntries();
  }, [isAuthenticated]);

  const fetchEntries = async () => {
    try {
      const response = await api.get('/diary');
      console.log('Fetched entries:', response.data);
      setEntries(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
      } else {
        toast.error('Failed to fetch entries');
      }
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        await api.delete(`/diary/${id}`);
        setEntries(entries.filter(entry => entry._id !== id));
        toast.success('Entry deleted successfully');
      } catch (error) {
        toast.error('Failed to delete entry');
      }
    }
  };

  // FIXED: PDF download with proper formatting
  const downloadPDF = (entry) => {
    if (!entry) return;

    if (entry.isLocked) {
      toast.error('Please unlock the entry first to download PDF');
      return;
    }

    try {
      const doc = new jsPDF();
      let yPosition = 20;

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(entry.title, 20, yPosition);
      yPosition += 15;

      // Date and Mood (fixed formatting)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${format(new Date(entry.date), 'PPP')}`, 20, yPosition);
      yPosition += 7;
      
      // Use plain text mood instead of special characters
      const moodDisplay = moodText[entry.mood] || 'Neutral';
      doc.text(`Mood: ${moodDisplay}`, 20, yPosition);
      yPosition += 7;
      
      // Tags
      if (entry.tags && entry.tags.length > 0) {
        doc.text(`Tags: ${entry.tags.join(', ')}`, 20, yPosition);
        yPosition += 7;
      }

      // Content
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Entry:', 20, yPosition);
      yPosition += 7;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const cleanContent = entry.content ? entry.content.replace(/<[^>]*>/g, '') : '';
      const splitContent = doc.splitTextToSize(cleanContent, 170);
      
      splitContent.forEach((line) => {
        if (yPosition > 280) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, 20, yPosition);
        yPosition += 7;
      });

      // Save the PDF
      doc.save(`diary-entry-${entry._id}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('PDF error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600"></div>
          <p className="text-gray-600 font-medium">Loading your diary entries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                My Diary Entries
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Capture your thoughts and memories in style</p>
            </div>
            <Link
              to="/create"
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl font-medium"
            >
              ✍️ Write New Entry
            </Link>
          </div>
        </motion.div>

        {!entries || entries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">📖</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Your diary is empty</h2>
              <p className="text-gray-500 text-lg mb-8">Start your journey of self-reflection and memories</p>
              <Link
                to="/create"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl font-medium text-lg"
              >
                <span className="mr-2">✨</span>
                Create Your First Entry
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
          >
            {entries.map((entry, index) => (
              <motion.div
                key={entry._id || index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-white/20 hover:border-purple-200 overflow-hidden"
              >
                <div className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 group-hover:text-purple-600 transition-colors line-clamp-2">
                      {entry.title || 'Untitled'}
                    </h2>
                    <div className="flex items-center space-x-2 ml-4">
                      {entry.isLocked ? (
                        <div className="p-2 bg-yellow-100 rounded-full">
                          <Lock className="h-5 w-5 text-yellow-600" />
                        </div>
                      ) : (
                        <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full">
                          <span className="text-xl">{moodIcons[entry.mood] || '😐'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {entry.isLocked ? (
                    <div className="flex items-center space-x-2 text-gray-500 mb-6 py-4">
                      <Lock className="h-5 w-5" />
                      <p className="text-lg">This entry is locked</p>
                    </div>
                  ) : (
                    <>
                      <div
                        className="text-gray-600 mb-6 line-clamp-4 text-lg leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: entry.content && entry.content.length > 200
                            ? entry.content.substring(0, 200) + '...'
                            : entry.content || 'No content'
                        }}
                      />

                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                          {entry.tags.slice(0, 3).map((tag, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-sm rounded-full font-medium"
                            >
                              #{tag}
                            </span>
                          ))}
                          {entry.tags.length > 3 && (
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full font-medium">
                              +{entry.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500 font-medium">
                      {entry.date ? format(new Date(entry.date), 'MMM dd, yyyy') : 'No date'}
                    </div>
                    <div className="flex items-center space-x-1">
                      <Link
                        to={`/entry/${entry._id}`}
                        className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-110"
                        title="View Entry"
                      >
                        <Eye className="h-5 w-5" />
                      </Link>
                      
                      {/* Edit button - ALWAYS show for all entries */}
                      <Link
                        to={`/edit/${entry._id}`}
                        className="p-3 text-green-600 hover:bg-green-50 rounded-xl transition-all duration-200 hover:scale-110"
                        title="Edit Entry"
                      >
                        <Edit className="h-5 w-5" />
                      </Link>
                      
                      <button
                        onClick={() => handleDelete(entry._id)}
                        className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 hover:scale-110"
                        title="Delete Entry"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                      
                      {/* Download button - Only for unlocked entries */}
                      {!entry.isLocked && (
                        <button
                          onClick={() => downloadPDF(entry)}
                          className="p-3 text-purple-600 hover:bg-purple-50 rounded-xl transition-all duration-200 hover:scale-110"
                          title="Download PDF"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
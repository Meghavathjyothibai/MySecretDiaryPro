import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit, Download, Lock, Calendar as CalendarIcon, Key, Image, Mic } from 'lucide-react';
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

const ViewEntry = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api, isAuthenticated } = useAuth();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [entryPassword, setEntryPassword] = useState('');
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [unlockAttempts, setUnlockAttempts] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (id) {
      fetchEntry();
    }
  }, [id, isAuthenticated]);

  const fetchEntry = async () => {
    try {
      const response = await api.get(`/diary/${id}`);
      console.log('Fetched entry:', response.data);
      
      if (response.data.isLocked) {
        setIsLocked(true);
        setShowLockScreen(true);
        setEntry({
          _id: response.data._id,
          title: response.data.title,
          isLocked: true,
          date: response.data.date,
          mood: response.data.mood,
          tags: response.data.tags || []
        });
      } else {
        setEntry(response.data);
        setIsLocked(false);
        setShowLockScreen(false);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to fetch entry');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!entryPassword) {
      toast.error('Please enter the entry password');
      return;
    }

    try {
      const response = await api.post(`/diary/${id}/unlock`, {
        password: entryPassword
      });

      if (response.data.success) {
        setIsLocked(false);
        setShowLockScreen(false);
        setEntry(response.data.entry);
        setEntryPassword('');
        toast.success('Entry unlocked successfully');
      }
    } catch (error) {
      console.error('Unlock error:', error);
      setUnlockAttempts(prev => prev + 1);
      
      if (error.response?.status === 401) {
        toast.error('Wrong password');
      } else {
        toast.error('Failed to unlock entry');
      }
    }
  };

  const handleEditClick = () => {
    navigate(`/edit/${id}`, { 
      state: { 
        entry: entry,
        password: entryPassword 
      } 
    });
  };

  // FIXED: PDF download with proper formatting and media
  const downloadAsPDF = () => {
    if (!entry || isLocked) {
      toast.error('Please unlock the entry first');
      return;
    }

    try {
      const doc = new jsPDF();
      let yPosition = 20;

      // Title
      doc.setFontSize(24);
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
      if (entry.tags?.length > 0) {
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
      const cleanContent = entry.content?.replace(/<[^>]*>/g, '') || '';
      const splitContent = doc.splitTextToSize(cleanContent, 170);
      
      splitContent.forEach((line) => {
        if (yPosition > 280) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, 20, yPosition);
        yPosition += 7;
      });
      yPosition += 10;

      // Images section
      if (entry.images?.length > 0) {
        if (yPosition > 260) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Attached Images:', 20, yPosition);
        yPosition += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        entry.images.forEach((image, index) => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 20;
          }
          // Add image filename or URL as text (since we can't embed images easily)
          const imageName = image.split('/').pop() || `Image ${index + 1}`;
          doc.text(`• Image ${index + 1}: ${imageName}`, 25, yPosition);
          yPosition += 5;
        });
        yPosition += 5;
      }

      // Voice Notes section
      if (entry.voiceNotes?.length > 0) {
        if (yPosition > 260) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Voice Notes:', 20, yPosition);
        yPosition += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        entry.voiceNotes.forEach((note, index) => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 20;
          }
          const noteName = note.split('/').pop() || `Voice Note ${index + 1}`;
          doc.text(`• Voice Note ${index + 1}: ${noteName}`, 25, yPosition);
          yPosition += 5;
        });
      }

      // Save the PDF
      const fileName = entry.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      doc.save(`${fileName}.pdf`);
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Entry not found</h2>
        <Link to="/" className="text-purple-600 hover:text-purple-700">Back to Dashboard</Link>
      </div>
    );
  }

  if (showLockScreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto px-4 py-8"
      >
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl p-12 border border-white/20 text-center">
          <div className="w-24 h-24 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">This Entry is Locked</h2>
          <p className="text-gray-600 mb-2">Enter the entry password to view</p>
          <p className="text-sm text-gray-500 mb-8">(Different from your login password)</p>
          
          <div className="max-w-md mx-auto">
            <div className="relative mb-4">
              <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="password"
                placeholder="Enter entry password"
                value={entryPassword}
                onChange={(e) => setEntryPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleUnlock()}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                autoFocus
              />
            </div>
            
            {unlockAttempts > 2 && (
              <p className="text-sm text-red-500 mb-4">
                Forgot password? Entries cannot be recovered.
              </p>
            )}
            
            <div className="flex gap-4">
              <button
                onClick={handleUnlock}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
              >
                Unlock Entry
              </button>
              <Link
                to="/"
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 transition-all font-medium"
              >
                Back
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-4 py-8"
    >
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/"
          className="flex items-center space-x-2 text-purple-600 hover:text-purple-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex space-x-2">
          <button
            onClick={handleEditClick}
            className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Edit className="h-4 w-4" />
            <span>Edit</span>
          </button>
          <button
            onClick={downloadAsPDF}
            className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      <motion.div
        className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl p-8"
      >
        <h1 className="text-4xl font-bold text-gray-800 mb-4">{entry.title}</h1>
        
        <div className="flex items-center space-x-6 mb-6">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="h-4 w-4" />
            <span>{format(new Date(entry.date), 'PPP')}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>Mood:</span>
            <span className="text-2xl">{moodIcons[entry.mood] || '😐'}</span>
          </div>
        </div>

        {entry.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {entry.tags.map((tag, index) => (
              <span key={index} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: entry.content }}
        />

        {entry.images?.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Image className="h-5 w-5" /> Images
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {entry.images.map((image, index) => {
                const imageUrl = image.startsWith('http') ? image : `https://mysecretdiarypro.onrender.com${image}`;
                return (
                  <img
                    key={index}
                    src={imageUrl}
                    alt={`Image ${index + 1}`}
                    className="w-full h-64 object-cover rounded-xl shadow-md"
                  />
                );
              })}
            </div>
          </div>
        )}

        {entry.voiceNotes?.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Mic className="h-5 w-5" /> Voice Notes
            </h3>
            <div className="space-y-2">
              {entry.voiceNotes.map((note, index) => {
                const audioUrl = note.startsWith('http') ? note: `https://mysecretdiarypro.onrender.com${note}`;
                return (
                  <audio
                    key={index}
                    controls
                    preload="metadata"
                    className="w-full"
                    src={audioUrl}
                  />
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default ViewEntry;
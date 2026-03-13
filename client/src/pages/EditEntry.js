import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import ReactQuill from 'react-quill';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, Mic, MicOff, X, Plus, Lock, Loader, Camera, Music, Square } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import 'react-quill/dist/quill.snow.css';

const moods = [
  { value: 'happy', label: 'Happy', icon: '😊' },
  { value: 'sad', label: 'Sad', icon: '😢' },
  { value: 'excited', label: 'Excited', icon: '🤩' },
  { value: 'calm', label: 'Calm', icon: '😌' },
  { value: 'angry', label: 'Angry', icon: '😠' },
  { value: 'anxious', label: 'Anxious', icon: '😰' },
  { value: 'grateful', label: 'Grateful', icon: '🙏' },
  { value: 'neutral', label: 'Neutral', icon: '😐' }
];

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ color: [] }, { background: [] }],
    ['link', 'image'],
    ['clean']
  ]
};

const EditEntry = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { api, isAuthenticated } = useAuth();
  const fileInputRef = useRef(null);
  
  // Get data from ViewEntry
  const passedEntry = location.state?.entry;
  const passedPassword = location.state?.password || '';
  
  const [loading, setLoading] = useState(!passedEntry);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  
  // Form states - convert to object format with IDs
  const [title, setTitle] = useState(passedEntry?.title || '');
  const [content, setContent] = useState(passedEntry?.content || '');
  const [mood, setMood] = useState(passedEntry?.mood || 'neutral');
  const [tags, setTags] = useState(passedEntry?.tags || []);
  const [currentTag, setCurrentTag] = useState('');
  const [images, setImages] = useState([]);
  const [voiceNotes, setVoiceNotes] = useState([]);

  // Initialize images and voice notes with proper format
  useEffect(() => {
    if (passedEntry?.images) {
      const formattedImages = passedEntry.images.map((img, index) => ({
        id: `existing-img-${index}-${Date.now()}`,
        url: img.startsWith('http') ? img : `http://localhost:5000${img}`,
        isTemp: false
      }));
      setImages(formattedImages);
    }
    
    if (passedEntry?.voiceNotes) {
      const formattedVoice = passedEntry.voiceNotes.map((note, index) => ({
        id: `existing-voice-${index}-${Date.now()}`,
        url: note.startsWith('http') ? note : `http://localhost:5000${note}`,
        isUploading: false
      }));
      setVoiceNotes(formattedVoice);
    }
  }, [passedEntry]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (!passedEntry && id) {
      fetchEntry();
    }
  }, [id, isAuthenticated]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const fetchEntry = async () => {
    try {
      const response = await api.get(`/diary/${id}`);
      const entryData = response.data;
      
      setTitle(entryData.title || '');
      setContent(entryData.content || '');
      setMood(entryData.mood || 'neutral');
      setTags(entryData.tags || []);
      
      // Format images
      if (entryData.images) {
        const formattedImages = entryData.images.map((img, index) => ({
          id: `img-${index}-${Date.now()}`,
          url: img.startsWith('http') ? img : `http://localhost:5000${img}`,
          isTemp: false
        }));
        setImages(formattedImages);
      }
      
      // Format voice notes
      if (entryData.voiceNotes) {
        const formattedVoice = entryData.voiceNotes.map((note, index) => ({
          id: `voice-${index}-${Date.now()}`,
          url: note.startsWith('http') ? note : `http://localhost:5000${note}`,
          isUploading: false
        }));
        setVoiceNotes(formattedVoice);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to fetch entry');
      navigate(`/entry/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Create blob URL once
        const blobUrl = URL.createObjectURL(audioBlob);
        const tempId = Date.now().toString();

        // Show immediately with blob URL
        setVoiceNotes((prev) => [
          ...prev,
          { id: tempId, url: blobUrl, isUploading: true }
        ]);

        const formData = new FormData();
        formData.append('voice', audioBlob, `voice-${Date.now()}.webm`);

        try {
          setUploadingVoice(true);
          const response = await api.post('/upload/voice', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          // Replace blob URL with real URL
          setVoiceNotes((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? { ...item, url: response.data.url, isUploading: false }
                : item
            )
          );

          toast.success('Voice note added successfully');
        } catch (error) {
          console.error('Voice upload error:', error);
          // Remove the temporary recording
          setVoiceNotes((prev) => prev.filter((item) => item.id !== tempId));
          URL.revokeObjectURL(blobUrl);
          toast.error('Failed to upload voice note');
        } finally {
          setUploadingVoice(false);
        }

        stream.getTracks().forEach(track => track.stop());
        audioChunksRef.current = [];
      };

      recorder.start();
      setIsRecording(true);

      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Recording error:', error);
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Add file size check (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    // Create preview URL once
    const previewUrl = URL.createObjectURL(file);
    const tempId = Date.now().toString();

    // Show preview immediately
    setImages((prev) => [
      ...prev,
      {
        id: tempId,
        url: previewUrl,
        isTemp: true
      }
    ]);

    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploadingImage(true);
      const response = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Replace preview with real URL
      setImages((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? { id: response.data.url, url: response.data.url, isTemp: false }
            : item
        )
      );

      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Image upload error:', error);
      // Remove preview on error
      setImages((prev) => prev.filter((item) => item.id !== tempId));
      URL.revokeObjectURL(previewUrl);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleRemoveImage = (index) => {
    const imageToRemove = images[index];
    // Only revoke blob URLs when removing
    if (imageToRemove.url?.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    setImages(images.filter((_, i) => i !== index));
  };

  const handleRemoveVoiceNote = (index) => {
    const noteToRemove = voiceNotes[index];
    // Only revoke blob URLs when removing
    if (noteToRemove.url?.startsWith('blob:')) {
      URL.revokeObjectURL(noteToRemove.url);
    }
    setVoiceNotes(voiceNotes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    
    if (!content.trim()) {
      toast.error('Content is required');
      return;
    }
    
    // Check if any uploads are still in progress
    if (uploadingImage || uploadingVoice) {
      toast.error('Please wait for uploads to complete');
      return;
    }

    // Check if there are any temporary items
    const hasTempImages = images.some((img) => img.isTemp);
    const hasTempVoice = voiceNotes.some((v) => v.isUploading);

    if (hasTempImages || hasTempVoice) {
      toast.error('Please wait for all uploads to complete');
      return;
    }

    setSaving(true);

    try {
      // Extract just the URLs for saving
      const saveImages = images.map((img) => img.url.replace('http://localhost:5000', ''));
      const saveVoiceNotes = voiceNotes.map((v) => v.url.replace('http://localhost:5000', ''));
      
      const response = await api.put(`/diary/${id}`, {
        title: title.trim(),
        content: content,
        mood: mood,
        tags: tags,
        images: saveImages,
        voiceNotes: saveVoiceNotes,
        password: passedPassword
      });

      if (response.data) {
        toast.success('Entry updated successfully');
        navigate(`/entry/${id}`);
      }
    } catch (error) {
      console.error('Update error:', error);
      
      if (error.response?.status === 403) {
        const password = window.prompt('This entry is locked. Please enter the password to save:');
        if (password) {
          try {
            const saveImages = images.map((img) => img.url.replace('http://localhost:5000', ''));
            const saveVoiceNotes = voiceNotes.map((v) => v.url.replace('http://localhost:5000', ''));
            
            const response = await api.put(`/diary/${id}`, {
              title: title.trim(),
              content: content,
              mood: mood,
              tags: tags,
              images: saveImages,
              voiceNotes: saveVoiceNotes,
              password: password
            });
            
            if (response.data) {
              toast.success('Entry updated successfully');
              navigate(`/entry/${id}`);
            }
          } catch (secondError) {
            toast.error('Wrong password. Changes not saved.');
          }
        }
      } else if (error.response?.status === 401) {
        toast.error('Wrong password. Changes not saved.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to update entry');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto px-4 py-8 max-w-4xl"
    >
      <div className="mb-6">
        <button
          onClick={() => navigate(`/entry/${id}`)}
          className="flex items-center space-x-2 text-purple-600 hover:text-purple-800"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Entry</span>
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Edit Entry</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-gray-700 font-bold mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
              required
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-gray-700 font-bold mb-2">Content *</label>
            <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
              <ReactQuill
                value={content}
                onChange={setContent}
                modules={modules}
                theme="snow"
                className="bg-white"
              />
            </div>
          </div>

          {/* Mood */}
          <div>
            <label className="block text-gray-700 font-bold mb-2">Mood</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {moods.map((moodOption) => (
                <button
                  key={moodOption.value}
                  type="button"
                  onClick={() => setMood(moodOption.value)}
                  className={`p-4 rounded-xl border-2 ${
                    mood === moodOption.value
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{moodOption.icon}</div>
                  <div className="text-sm font-medium">{moodOption.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-gray-700 font-bold mb-2">Tags</label>
            <div className="flex space-x-2 mb-3">
              <input
                type="text"
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag"
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700"
              >
                Add
              </button>
            </div>
            
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span key={index} className="bg-purple-100 text-purple-800 px-3 py-1.5 rounded-full text-sm flex items-center">
                    #{tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-2">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Images */}
          <div>
            <label className="block text-gray-700 font-bold mb-2">Images</label>
            <div className="flex items-center gap-4 mb-4">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
                disabled={uploadingImage}
              />
              <label
                htmlFor="image-upload"
                className={`px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer flex items-center gap-2 ${
                  uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {uploadingImage ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                {uploadingImage ? 'Uploading...' : 'Upload Image'}
              </label>
            </div>

            <AnimatePresence>
              {images.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4"
                >
                  {images.map((image, index) => (
                    <motion.div
                      key={image.id}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="relative group"
                    >
                      <img
                        src={image.url}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-40 object-cover rounded-xl shadow-md"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/300?text=Image+Error';
                        }}
                      />
                      {image.isTemp && (
                        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                          <Loader className="h-8 w-8 text-white animate-spin" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-lg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Voice Notes */}
          <div>
            <label className="block text-gray-700 font-bold mb-2">Voice Notes</label>
            
            <div className="mb-4">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={uploadingVoice}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                } text-white transition-colors ${uploadingVoice ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="h-5 w-5" />
                    Stop Recording ({formatTime(recordingTime)})
                  </>
                ) : (
                  <>
                    <Music className="h-5 w-5" />
                    {uploadingVoice ? 'Uploading...' : 'Start Recording'}
                  </>
                )}
              </button>
            </div>

            <AnimatePresence>
              {voiceNotes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-2"
                >
                  {voiceNotes.map((note, index) => (
                    <motion.div
                      key={note.id}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group border border-gray-200"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Music className="h-5 w-5 text-purple-500" />
                        <span className="text-sm font-medium text-gray-700">
                          Voice Note {index + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <audio
                          controls
                          preload="metadata"
                          className="h-8 w-48"
                          src={note.url}
                          onLoadedMetadata={(e) => {
                            // Force duration calculation for blob URLs
                            if (e.target.duration === Infinity || isNaN(e.target.duration)) {
                              e.target.currentTime = 1e101;
                              e.target.ontimeupdate = () => {
                                e.target.currentTime = 0;
                                e.target.ontimeupdate = null;
                              };
                            }
                          }}
                        >
                          Your browser does not support the audio element.
                        </audio>
                        {note.isUploading && (
                          <div className="absolute inset-0 bg-black/5 rounded-xl flex items-center justify-center pointer-events-none">
                            <span className="text-xs text-purple-600 bg-white px-2 py-1 rounded-full">
                              Uploading...
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveVoiceNote(index)}
                          className="p-1 text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving || uploadingImage || uploadingVoice}
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-8 rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default EditEntry;
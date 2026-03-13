import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactQuill from 'react-quill';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Mic, MicOff, X, Plus, Lock, Loader, Camera, Music } from 'lucide-react';
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

const CreateEntry = () => {
  const navigate = useNavigate();
  const { token } = useAuth();

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('neutral');
  const [tags, setTags] = useState([]);
  const [currentTag, setCurrentTag] = useState('');
  const [images, setImages] = useState([]);
  const [voiceNotes, setVoiceNotes] = useState([]);
  const [lockEntry, setLockEntry] = useState(false);
  const [entryPassword, setEntryPassword] = useState('');

  // UI states
  const [recording, setRecording] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  // Configure axios with token
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

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
        // FIX: Changed from 'audio' to 'voice' to match backend
        formData.append('voice', audioBlob, `voice-${Date.now()}.webm`);

        try {
          setUploadingVoice(true);
          const response = await axios.post('http://localhost:5000/api/upload/voice', formData, {
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

          toast.success('Voice note recorded successfully');
        } catch (error) {
          console.error('Upload error:', error);
          // Remove the temporary recording
          setVoiceNotes((prev) => prev.filter((item) => item.id !== tempId));
          URL.revokeObjectURL(blobUrl);
          toast.error('Failed to upload voice note');
        } finally {
          setUploadingVoice(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          setRecordingTime(0);
        }

        stream.getTracks().forEach(track => track.stop());
        audioChunksRef.current = [];
      };

      recorder.start();
      setRecording(true);

      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      toast.success('Recording started...');
    } catch (error) {
      console.error('Microphone error:', error);
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
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
      const response = await axios.post('http://localhost:5000/api/upload/image', formData, {
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
      console.error('Upload error:', error);
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

  const addTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const removeImage = (index) => {
    const imageToRemove = images[index];
    // Only revoke blob URLs when removing
    if (imageToRemove.url?.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    setImages(images.filter((_, i) => i !== index));
  };

  const removeVoiceNote = (index) => {
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
      toast.error('Please enter a title');
      return;
    }

    if (!content.trim()) {
      toast.error('Please write your thoughts');
      return;
    }

    if (lockEntry && !entryPassword) {
      toast.error('Please set a password for locked entry');
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

    setIsSubmitting(true);

    try {
      // Extract just the URLs for saving
      const saveImages = images.map((img) => img.url);
      const saveVoiceNotes = voiceNotes.map((v) => v.url);

      const entryData = {
        title: title.trim(),
        content: content,
        mood: mood,
        tags: tags,
        images: saveImages,
        voiceNotes: saveVoiceNotes,
        isLocked: lockEntry,
        password: lockEntry ? entryPassword : null
      };

      await axios.post('http://localhost:5000/api/diary', entryData);
      
      toast.success('Entry created successfully!');
      navigate('/');
    } catch (error) {
      console.error('Create error:', error);
      
      if (error.response?.status === 401) {
        toast.error('Please login again');
        navigate('/login');
      } else {
        toast.error(error.response?.data?.error || 'Failed to create entry');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-4 py-8"
    >
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-white/20">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Create New Entry</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              placeholder="Give your entry a title..."
              required
            />
          </div>

          {/* Mood */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How are you feeling today?
            </label>
            <div className="flex flex-wrap gap-2">
              {moods.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(m.value)}
                  className={`px-4 py-2 rounded-full border-2 transition-all ${
                    mood === m.value
                      ? 'bg-purple-600 text-white border-purple-600 scale-105'
                      : 'border-gray-200 hover:border-purple-400 hover:bg-purple-50'
                  }`}
                >
                  <span className="mr-2">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Thoughts <span className="text-red-500">*</span>
            </label>
            <ReactQuill
              theme="snow"
              value={content}
              onChange={setContent}
              modules={modules}
              className="h-64 mb-12"
              placeholder="Write your thoughts here..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                placeholder="Add tags (press Enter)"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full flex items-center gap-2 text-sm"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Images
            </label>
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
                        onClick={() => removeImage(index)}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Voice Notes
            </label>
            <div className="mb-4">
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={uploadingVoice}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  recording
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                } text-white transition-colors ${uploadingVoice ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {recording ? (
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
                          onClick={() => removeVoiceNote(index)}
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

          {/* Lock Feature */}
          <div className="p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={lockEntry}
                onChange={(e) => setLockEntry(e.target.checked)}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="text-gray-700 font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" /> Lock this entry with password
              </span>
            </label>
            
            {lockEntry && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4"
              >
                <input
                  type="password"
                  placeholder="Enter password to lock this entry"
                  value={entryPassword}
                  onChange={(e) => setEntryPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                  required={lockEntry}
                />
                <p className="text-sm text-gray-500 mt-2">
                  ⚠️ You'll need this password to view the entry later
                </p>
              </motion.div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || uploadingImage || uploadingVoice}
              className={`px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 flex-1 font-medium flex items-center justify-center gap-2 ${
                (isSubmitting || uploadingImage || uploadingVoice) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Entry'
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default CreateEntry;
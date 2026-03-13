import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogOut, User, Calendar, Search, Home } from 'lucide-react';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white/80 backdrop-blur-lg shadow-lg sticky top-0 z-50 border-b border-white/20">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <BookOpen className="h-8 w-8 text-purple-600" />
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Secret Diary
            </span>
          </Link>

          {/* Navigation Links */}
          {isAuthenticated ? (
            <>
              <div className="hidden md:flex items-center space-x-6">
                <Link to="/" className="flex items-center space-x-1 text-gray-700 hover:text-purple-600 transition-colors">
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </Link>
                <Link to="/calendar" className="flex items-center space-x-1 text-gray-700 hover:text-purple-600 transition-colors">
                  <Calendar className="h-4 w-4" />
                  <span>Calendar</span>
                </Link>
                <Link to="/search" className="flex items-center space-x-1 text-gray-700 hover:text-purple-600 transition-colors">
                  <Search className="h-4 w-4" />
                  <span>Search</span>
                </Link>
              </div>

              <div className="flex items-center space-x-4">
                <Link to="/profile" className="flex items-center space-x-2 text-gray-700 hover:text-purple-600 transition-colors">
                  <User className="h-5 w-5" />
                  <span className="hidden md:inline">{user?.username || 'Profile'}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 text-gray-700 hover:text-red-600 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-gray-700 hover:text-purple-600 transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { MessageSquare, LogIn, UserPlus, MessageCircle, LogOut, User as UserIcon, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

function Navbar() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleLogout = () => {
    logout();
    closeMenu();
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          <span className="navbar-brand-icon">
            <MessageSquare size={26} strokeWidth={2.5} />
          </span>
          <span>OmniChat</span>
        </Link>

        <button 
          className="navbar-toggle-btn" 
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <ul className={`navbar-links ${isOpen ? 'navbar-links-open' : ''}`}>
          {user ? (
            <>
              <li className="navbar-user-info">
                <UserIcon size={16} className="navbar-user-icon" />
                <span className="navbar-user-name">{user.userName}</span>
              </li>
              <li>
                <NavLink to="/chats" className="navbar-link" onClick={closeMenu}>
                  <MessageCircle size={16} />
                  <span>Chats</span>
                </NavLink>
              </li>
               <li>
                <NavLink to="/ai" className="navbar-link" onClick={closeMenu}>
                  <MessageCircle size={16} />
                  <span>AI Assistant</span>
                </NavLink>
              </li>
              <li>
                <button onClick={handleLogout} className="navbar-link navbar-logout-btn">
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <NavLink to="/signin" className="navbar-link" onClick={closeMenu}>
                  <LogIn size={16} />
                  <span>Sign In</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/signup" className="navbar-link" onClick={closeMenu}>
                  <UserPlus size={16} />
                  <span>Sign Up</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/chats" className="navbar-link" onClick={closeMenu}>
                  <MessageCircle size={16} />
                  <span>Chats</span>
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;

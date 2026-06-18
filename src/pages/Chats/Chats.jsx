import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Send,
  Info,
  Smile,
  Paperclip,
  MessageSquare,
  Sparkles,
  Lock,
  RefreshCw,
  Clock,
  ArrowLeft
} from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './Chats.css';

// Normalize any user/id-bearing object down to a plain string id so every
// comparison in this file (selection, ownership, online lookup) is done the
// same way and never silently fails due to ObjectId-vs-string mismatches.
const idOf = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value._id ? String(value._id) : value.id ? String(value.id) : null;
};

function Chats() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  // Mobile: whether the conversation panel is showing over the sidebar list
  const [showMobileChat, setShowMobileChat] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const activeChatRef = useRef(null);

  const currentUserId = idOf(currentUser);

  // 1. Fetch registered users for the sidebar on mount
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/auth/get-users');
      if (response.data && response.data.data) {
        setUsers(response.data.data);
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (status === 400 && message === 'No users Found') {
        setUsers([]);
      } else {
        const errMsg = message || 'Failed to fetch users';
        setError(errMsg);
        toast.error(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Scroll the message list (not the whole page) straight to the bottom.
  // Using scrollTop on the actual scroll container is far more reliable
  // than scrollIntoView when the surrounding layout is being resized
  // (window resize, mobile keyboard, flex containers, etc).
  const scrollToBottom = useCallback((smooth = true) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // 2. Establish Socket.IO connection and set up real-time listeners.
  // This effect only depends on the user's id (a primitive), not the whole
  // `currentUser` object, so it doesn't reconnect on every unrelated render.
  useEffect(() => {
    if (!currentUserId) return;

    const socketUrl = import.meta.env.VITE_BACKEND_URL.replace(/\/api\/?$/, '');
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    const announcePresence = () => socket.emit('user_online', currentUserId);

    socket.on('connect', () => {
      announcePresence();
      // If we already had a conversation open (e.g. the socket reconnected
      // after a dropped connection) make sure we're back in that room.
      if (activeChatRef.current?._id) {
        socket.emit('join_chat', activeChatRef.current._id);
      }
    });

    // Socket.IO auto-reconnects after network drops; re-announce presence
    // and rejoin the room every time, not just on the very first connect.
    socket.io.on('reconnect', announcePresence);

    socket.on('online_users', (userIds) => {
      setOnlineUserIds(Array.isArray(userIds) ? userIds : []);
    });

    socket.on('receive_message', (newMessage) => {
      // Only append if it belongs to the conversation currently open;
      // otherwise a message for a different chat could leak into view.
      const incomingChatId = idOf(newMessage.chats) || newMessage.chats;
      if (activeChatRef.current && incomingChatId !== idOf(activeChatRef.current)) {
        return;
      }
      setMessages((prev) => {
        if (prev.some((m) => m._id === newMessage._id)) return prev;
        return [...prev, newMessage];
      });
    });

    return () => {
      socket.io.off('reconnect', announcePresence);
      socket.disconnect();
    };
  }, [currentUserId]);

  // 3. Auto-scroll to latest messages — fires on new messages AND right
  // after the loading spinner disappears (so opening a chat lands at the
  // bottom of its history, just like a real chat app).
  useEffect(() => {
    if (messagesLoading) return;
    // Wait a tick so the DOM has actually painted the new message list
    // before we measure scrollHeight.
    const id = requestAnimationFrame(() => scrollToBottom(true));
    return () => cancelAnimationFrame(id);
  }, [messages, messagesLoading, scrollToBottom]);

  // 4. Click User -> Get/Create Chat Room -> Fetch Historical Messages & Join Socket Room
  const handleSelectUser = async (userToChat) => {
    setSelectedUser(userToChat);
    setShowMobileChat(true);
    setMessagesLoading(true);
    setMessages([]);
    setActiveChat(null);
    activeChatRef.current = null;

    const targetUserId = idOf(userToChat);

    try {
      const response = await api.post('/chats/create', {
        users: [targetUserId],
        isGroupChat: false
      });

      const chatRoom = response.data;
      setActiveChat(chatRoom);
      activeChatRef.current = chatRoom;

      if (socketRef.current) {
        socketRef.current.emit('join_chat', chatRoom._id);
      }

      const msgResponse = await api.get(`/messages/get/${chatRoom._id}`);
      if (Array.isArray(msgResponse.data)) {
        setMessages(msgResponse.data);
      }
    } catch (err) {
      console.error('Error starting conversation:', err);
      toast.error('Failed to establish connection with user');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
  };

  // 5. Send message via Socket (writes to database and broadcasts in real-time)
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !activeChat || !currentUserId) return;

    const messagePayload = {
      sender: currentUserId,
      content: messageText.trim(),
      chatId: activeChat._id
    };

    if (socketRef.current) {
      socketRef.current.emit('send_message', messagePayload);
    }

    setMessageText('');
    // Sending should always snap to the bottom immediately, without
    // waiting for the round-trip "receive_message" echo from the server.
    requestAnimationFrame(() => scrollToBottom(true));
  };

  // Filter users list by search query
  const filteredUsers = users.filter(u =>
    u.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check real-time presence (driven by the socket "online_users" broadcast)
  const isUserOnline = (u) => {
    const id = idOf(u);
    return id ? onlineUserIds.includes(id) : false;
  };

  // Avatar dynamic styling builder
  const getAvatarGradient = (name = 'A') => {
    const code = name.charCodeAt(0) % 5;
    const gradients = [
      'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', // Indigo to Purple
      'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', // Cyan to Blue
      'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Emerald
      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Amber
      'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', // Pink to Violet
    ];
    return gradients[code];
  };

  return (
    <div className="chats-page-wrapper">
      <div className="chats-container-card">
        {/* SIDEBAR PANEL */}
        <div className={`chats-sidebar ${showMobileChat ? 'mobile-hidden' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <Sparkles className="sparkle-icon animate-pulse-glow" size={18} />
              <h2>Conversations</h2>
            </div>

            {currentUser && (
              <div className="current-user-identity">
                <div
                  className="user-avatar-circle"
                  style={{ background: getAvatarGradient(currentUser.userName) }}
                >
                  {currentUser.userName?.charAt(0).toUpperCase()}
                </div>
                <div className="user-identity-details">
                  <span className="user-identity-name">{currentUser.userName}</span>
                  <span className="user-identity-status">Online</span>
                </div>
              </div>
            )}
          </div>

          <div className="sidebar-search">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="sidebar-users-list">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="skeleton-user-item">
                  <div className="skeleton-avatar shunt-pulse" />
                  <div className="skeleton-details">
                    <div className="skeleton-line-title shunt-pulse" />
                    <div className="skeleton-line-sub shunt-pulse" />
                  </div>
                </div>
              ))
            ) : error ? (
              <div className="sidebar-error-state">
                <p>{error}</p>
                <button onClick={fetchUsers} className="retry-btn">
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            ) : users.length === 0 ? (
              <div className="no-users-found">
                <div className="empty-globe-icon-wrapper">
                  <MessageSquare size={32} className="empty-message-icon" />
                </div>
                <h3>No Users Exist</h3>
                <p>You are currently the first member here! Once other users register, they will instantly appear in this sidebar.</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="no-search-results">
                <p>No contacts match "{searchQuery}"</p>
              </div>
            ) : (
              filteredUsers.map((u) => {
                const userId = idOf(u);
                const isSelected = idOf(selectedUser) === userId;
                const online = isUserOnline(u);
                return (
                  <button
                    key={userId}
                    onClick={() => handleSelectUser(u)}
                    className={`user-item-btn ${isSelected ? 'active' : ''}`}
                  >
                    <div
                      className="user-avatar-circle"
                      style={{ background: getAvatarGradient(u.userName) }}
                    >
                      {u.userName?.charAt(0).toUpperCase()}
                      {online && <span className="online-indicator-dot" />}
                    </div>
                    <div className="user-item-details">
                      <div className="user-item-header">
                        <span className="user-item-name">{u.userName}</span>
                        <span className={`user-item-time ${online ? 'is-online' : 'is-offline'}`}>
                          <Clock size={10} style={{ marginRight: '2px' }} /> {online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <span className="user-item-email">{u.email}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* FEED / CONVERSATION PANEL */}
        <div className={`chats-feed ${showMobileChat ? 'mobile-visible' : ''}`}>
          {selectedUser ? (
            <div className="feed-active-chat">
              {/* Header bar */}
              <div className="chat-header">
                <div className="chat-header-identity">
                  <button className="mobile-back-btn" onClick={handleBackToList} title="Back to conversations">
                    <ArrowLeft size={18} />
                  </button>
                  <div
                    className="user-avatar-circle"
                    style={{ background: getAvatarGradient(selectedUser.userName) }}
                  >
                    {selectedUser.userName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="chat-header-details">
                    <h3>{selectedUser.userName}</h3>
                    <span className={`header-status ${isUserOnline(selectedUser) ? 'is-online' : 'is-offline'}`}>
                      <span className={`status-pulse-dot ${isUserOnline(selectedUser) ? '' : 'offline'}`} />
                      {isUserOnline(selectedUser) ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>

                <div className="chat-header-actions">
                  <button className="action-btn" title="Conversation Details">
                    <Info size={18} />
                  </button>
                </div>
              </div>

              {/* Messages feed area */}
              <div className="chat-messages-container" ref={messagesContainerRef}>
                {messagesLoading ? (
                  <div className="feed-messages-loading">
                    <RefreshCw className="spinner-icon animate-pulse-glow" size={24} />
                    <p>Loading message logs...</p>
                  </div>
                ) : (
                  <div className="messages-scroller">
                    {/* End-to-end encryption notification bubble */}
                    <div className="system-indicator-message">
                      <Lock size={12} className="lock-icon" />
                      <span>🔒 Messages are end-to-end encrypted. No one outside of this chat, not even OmniChat, can read them.</span>
                    </div>

                    {messages.map((msg) => {
                      const senderId = idOf(msg.sender);
                      // Defensive: only ever treat a message as "outgoing"
                      // when we can positively confirm both ids. If either
                      // side is momentarily unknown, default to "incoming"
                      // so we never mislabel someone else's message as ours.
                      const isCurrentUser = Boolean(senderId && currentUserId && senderId === currentUserId);

                      return (
                        <div
                          key={msg._id || msg.id}
                          className={`message-bubble-wrapper ${isCurrentUser ? 'outgoing' : 'incoming'}`}
                        >
                          {!isCurrentUser && (
                            <div
                              className="bubble-avatar"
                              style={{ background: getAvatarGradient(msg.sender?.userName || selectedUser.userName) }}
                            >
                              {(msg.sender?.userName || selectedUser.userName)?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="bubble-content-box">
                            <p className="bubble-text">{msg.content}</p>
                            <span className="bubble-timestamp">
                              {msg.createdAt
                                ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              }
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input field footer */}
              <form onSubmit={handleSendMessage} className="chat-input-bar">
                <div className="input-options-group">
                  <button type="button" className="input-icon-btn" title="Attach file">
                    <Paperclip size={18} />
                  </button>
                  <button type="button" className="input-icon-btn" title="Add emoji">
                    <Smile size={18} />
                  </button>
                </div>

                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={`Write your message to ${selectedUser.userName}...`}
                  className="chat-message-input"
                />

                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className="chat-send-btn"
                  title="Send message"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          ) : (
            <div className="feed-empty-state">
              <div className="welcome-glow-orb" />
              <div className="welcome-graphic">
                <MessageSquare className="graphic-icon animate-pulse-glow" size={48} />
              </div>
              <h2>Select a Conversation</h2>
              <p>Choose an active contact from the sidebar list to start exchanging real-time secure messages. OmniChat keeps your data protected.</p>

              <div className="welcome-badge">
                <Lock size={12} />
                <span>End-to-End Encrypted Space</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Chats;

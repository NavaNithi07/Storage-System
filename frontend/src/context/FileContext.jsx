import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../services/api';

const FileContext = createContext(null);

export function FileProvider({ children, pollIntervalMs = 10000 }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [socket, setSocket] = useState(null);
  const pollRef = useRef(null);

  const bumpRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    // Use dedicated VITE_SOCKET_URL so it works when VITE_API_BASE_URL is a relative path (Vite proxy mode)
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    console.log('[Socket] Initializing connection to:', socketUrl);
    
    const token = localStorage.getItem('token');
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      auth: token ? { token } : {},
    });
    
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected to Socket.IO server');
    });

    socketInstance.on('fileDeleted', (deletedFileId) => {
      console.log('[Socket] File deletion synchronized:', deletedFileId);
      bumpRefresh();
    });

    socketInstance.on('trashUpdated', (deletedFileId) => {
      console.log('[Socket] Permanent deletion synchronized:', deletedFileId);
      bumpRefresh();
    });

    socketInstance.on('storageUpdated', () => {
      console.log('[Socket] Storage recalculation synchronized');
      bumpRefresh();
    });

    socketInstance.on('dashboardUpdated', () => {
      console.log('[Socket] Dashboard metrics synchronized');
      bumpRefresh();
    });

    socketInstance.on('disconnect', () => {
      console.log('[Socket] Disconnected from Socket.IO server');
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [bumpRefresh]);

  // Fallback auto-poll every `pollIntervalMs` ms
  useEffect(() => {
    pollRef.current = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, pollIntervalMs);
    return () => clearInterval(pollRef.current);
  }, [pollIntervalMs]);

  return (
    <FileContext.Provider value={{ refreshKey, bumpRefresh, socket }}>
      {children}
    </FileContext.Provider>
  );
}

export function useFileContext() {
  const ctx = useContext(FileContext);
  if (!ctx) throw new Error('useFileContext must be used inside FileProvider');
  return ctx;
}

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../services/api';

const FileContext = createContext(null);

export function FileProvider({ children, pollIntervalMs = 60000 }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const pollRef = useRef(null);

  const bumpRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    // Use dedicated VITE_SOCKET_URL so it works when VITE_API_BASE_URL is a relative path (Vite proxy mode)
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'https://vibna-storage-backend.onrender.com';

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
      setIsConnected(true);
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
      setIsConnected(false);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [bumpRefresh]);

  // Fallback auto-poll only if Socket.IO is disconnected
  useEffect(() => {
    if (isConnected) return; // Skip polling when real-time socket is active
    pollRef.current = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, pollIntervalMs);
    return () => clearInterval(pollRef.current);
  }, [isConnected, pollIntervalMs]);

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

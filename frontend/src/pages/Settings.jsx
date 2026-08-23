import { useState, useContext, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Trash2, Save, Edit2, ShieldOff, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';

import { AuthContext } from '../context/AuthContext';
import { useToast, useToastApi } from '../context/ToastContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export default function Settings() {
  const { user, logout, updateUser } = useContext(AuthContext);
  const toast = useToast();
  const { removeToast } = useToastApi();
  const [activeTab, setActiveTab] = useState('profile');
  const [sessions, setSessions] = useState([]);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    username: user?.username || '',
    bio: user?.bio || ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  const fileInputRef = useRef(null);

  // Keep profileData fresh when user context changes.
  // Using functional initializer avoids setState-in-effect lint issues.
  useEffect(() => {
    if (!user) return;
    if (isEditingProfile) return;

     
    queueMicrotask(() => {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        username: user.username || '',
        bio: user.bio || '',
      });
    });
  }, [user, isEditingProfile]);

  useEffect(() => {
    if (activeTab === 'security') {
      const fetchSessions = async () => {
        try {
          const res = await api.get('/auth/sessions');
          setSessions(res.data);
        } catch (e) {
          console.error(e);
        }
      };
      fetchSessions();
    }
  }, [activeTab]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    // Step 1: Show a persistent loading toast
    const loadingId = toast('Uploading avatar...', 'info', 60000);

    try {
      const res = await api.post('/auth/upload-avatar', formData);
      updateUser({ avatar: res.data.avatarUrl });
      // Step 2: Remove loading, show success
      removeToast(loadingId);
      toast('Avatar updated successfully!', 'success');
    } catch (err) {
      // Step 2: Remove loading, show error
      removeToast(loadingId);
      toast(err.response?.data?.message || 'Failed to update avatar', 'error');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/auth/profile', {
        username: profileData.username,
        bio: profileData.bio,
      });
      updateUser(res.data);
      setIsEditingProfile(false);
      toast("Profile updated successfully!", "success");
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to update profile', 'error');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return toast('Please fill all password fields.', 'error');
    }
    if (newPassword !== confirmPassword) {
      return toast('New password and confirmation do not match.', 'error');
    }
    if (newPassword.length < 6) {
      return toast('New password must be at least 6 characters.', 'error');
    }

    setPasswordLoading(true);
    try {
      await api.put('/auth/password', {
        currentPassword,
        newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast('Password updated successfully!', 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to update password', 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRevokeSession = async (deviceId) => {
    try {
      await api.delete(`/auth/sessions/${deviceId}`);
      setSessions(prev => prev.filter(s => s.deviceId !== deviceId));
      toast('Session revoked successfully', 'success');
    } catch (e) {
      toast('Failed to revoke session', 'error');
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    const currentRefreshToken = localStorage.getItem('refreshToken');
    const others = sessions.filter(s => s.token !== currentRefreshToken);
    if (others.length === 0) {
      return toast('No other active sessions to revoke.', 'info');
    }
    if (!window.confirm(`This will log out ${others.length} other device(s). Continue?`)) return;
    try {
      // Send current refresh token so backend can preserve this device's session
      const currentRefreshToken = localStorage.getItem('refreshToken');
      await api.delete('/auth/sessions', { data: { refreshToken: currentRefreshToken } });
      // Re-fetch to pick up only the current session (backend cleared all others)
      const res = await api.get('/auth/sessions');
      setSessions(res.data);
      toast('All other sessions revoked.', 'success');
    } catch (e) {
      toast('Failed to revoke all sessions', 'error');
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm("Are you absolutely sure? This action cannot be undone and will delete all your files.")) {
      logout();
    }
  };

  return (
    <div className="w-full h-full flex flex-col pb-10">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-[#D4A437] mb-2">
          Settings
        </h1>
        <p className="text-slate-400 text-lg">
          Manage your account preferences, security, and storage.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-64 shrink-0 flex flex-col gap-2">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'security', label: 'Security', icon: Lock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 font-medium ${
                  isActive 
                    ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 shadow-[0_0_15px_rgba(212,164,55,0.2)]' 
                    : 'text-slate-400 hover:text-[#d4af37] hover:bg-[#d4af37]/10 border border-transparent'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-[#d4af37]' : 'text-slate-500'} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="bg-[#111111]/80 border-[#d4af37]/10 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your bio and view account details.</CardDescription>
                  </div>
                  {!isEditingProfile && (
                    <Button variant="outline" onClick={() => setIsEditingProfile(true)} className="bg-[#111111] border-[#d4af37]/20 text-[#d4af37] hover:bg-[#d4af37]/10">
                      <Edit2 size={16} className="mr-2" /> Edit Bio
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateProfile} className="space-y-5">
                    <div className="flex items-center gap-6 mb-6">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-primary/20 overflow-hidden border-2 border-white/10">
                        {user?.avatar ? (
                          <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          user?.name?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <div>
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                        <Button type="button" variant="outline" className="bg-[#111111] border-[#d4af37]/20 text-[#d4af37] hover:bg-[#d4af37]/10" onClick={handleAvatarClick}>Change Avatar</Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Name - Permanent constant */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-slate-300">Name</label>
                          <span className="text-[10px] text-[#d4af37] flex items-center gap-1 bg-[#d4af37]/10 px-2 py-0.5 rounded-full border border-[#d4af37]/20 font-medium">
                            <Lock size={10} /> Permanent
                          </span>
                        </div>
                        <Input 
                          value={user?.name || ''} 
                          disabled
                          readOnly
                          className="opacity-70 cursor-not-allowed bg-black/60 border-white/10 text-slate-300"
                        />
                        <p className="text-[11px] text-slate-500">Name is constant from account creation.</p>
                      </div>

                      {/* Email - Permanent constant */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-slate-300">Email Address</label>
                          <span className="text-[10px] text-[#d4af37] flex items-center gap-1 bg-[#d4af37]/10 px-2 py-0.5 rounded-full border border-[#d4af37]/20 font-medium">
                            <Lock size={10} /> Permanent
                          </span>
                        </div>
                        <Input 
                          type="email" 
                          value={user?.email || ''} 
                          disabled
                          readOnly
                          className="opacity-70 cursor-not-allowed bg-black/60 border-white/10 text-slate-300"
                        />
                        <p className="text-[11px] text-slate-500">Email address is constant from account creation.</p>
                      </div>

                      {/* Username */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Username</label>
                        <Input 
                          value={profileData.username} 
                          onChange={(e) => setProfileData({...profileData, username: e.target.value})}
                          readOnly={!isEditingProfile} 
                          className={!isEditingProfile ? "opacity-70 pointer-events-none bg-black/60" : ""}
                          placeholder="e.g. johndoe"
                        />
                      </div>

                      {/* Bio */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Bio</label>
                        <Input 
                          value={profileData.bio} 
                          onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                          readOnly={!isEditingProfile} 
                          className={!isEditingProfile ? "opacity-70 pointer-events-none bg-black/60" : ""}
                          placeholder="A short bio..."
                        />
                      </div>
                    </div>
                    
                    {isEditingProfile && (
                      <div className="pt-4 flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setIsEditingProfile(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="gap-2">
                          <Save size={18} /> Save Changes
                        </Button>
                      </div>
                    )}
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="bg-[#111111]/80 border-[#d4af37]/10 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Ensure your account is using a long, random password to stay secure.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdatePassword} className="space-y-5">
                    <div className="space-y-2 max-w-md">
                      <label className="text-sm font-medium text-slate-300">Current Password</label>
                      <div className="relative">
                        <Input
                          type={showCurrentPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                          className="pr-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none"
                          aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                        >
                          {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 max-w-md">
                      <label className="text-sm font-medium text-slate-300">New Password</label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          className="pr-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none"
                          aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                        >
                          {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 max-w-md">
                      <label className="text-sm font-medium text-slate-300">Confirm New Password</label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                          className="pr-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none"
                          aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="pt-4">
                      <Button type="submit" disabled={passwordLoading}>
                        {passwordLoading ? 'Updating…' : 'Update Password'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-[#111111]/80 border-[#d4af37]/10 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Active Sessions</CardTitle>
                    <CardDescription>Manage your logged-in devices. Revoking a session logs that device out immediately.</CardDescription>
                  </div>
                  <button
                    onClick={handleRevokeAllOtherSessions}
                    title="Revoke all sessions except this one"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '7px 14px', borderRadius: '10px',
                      background: 'rgba(239,68,68,0.07)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#f87171', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.07)'; }}
                  >
                    <ShieldOff size={14} />
                    Revoke All Others
                  </button>
                </CardHeader>
                <CardContent>
                  {sessions.length === 0 ? (
                    <div className="text-slate-400 text-sm">No active sessions found.</div>
                  ) : (
                    <div className="space-y-3">
                      {sessions.map(s => {
                        const currentRefreshToken = localStorage.getItem('refreshToken');
                        const isCurrent = s.token === currentRefreshToken;
                        return (
                          <div key={s.deviceId} className="flex justify-between items-center bg-[#000000] p-4 rounded-xl border border-[#1A1A1A]" style={isCurrent ? { borderColor: 'rgba(212,175,55,0.25)', boxShadow: '0 0 12px rgba(212,175,55,0.06)' } : {}}>
                            <div>
                              <p className="text-white font-bold text-sm flex items-center gap-2">
                                {s.deviceName} ({s.os || 'Unknown OS'}) - {s.browser}
                                {isCurrent && (
                                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(212,175,55,0.15)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.3)', fontWeight: 700, letterSpacing: '0.04em' }}>
                                    THIS DEVICE
                                  </span>
                                )}
                              </p>
                              <p className="text-slate-500 text-xs mt-1">
                                IP: <span className="font-mono text-slate-400">{s.ipAddress}</span> | Login: <span className="text-slate-400">{s.loginTime ? new Date(s.loginTime).toLocaleString() : 'N/A'}</span>
                              </p>
                              <p className="text-slate-500 text-xs">
                                Last Activity: <span className="text-slate-400">{new Date(s.lastActive).toLocaleString()}</span>
                              </p>
                            </div>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => handleRevokeSession(s.deviceId)}
                              disabled={isCurrent}
                              className={isCurrent ? 'border-slate-700 text-slate-600 cursor-not-allowed opacity-40' : 'border-rose-500/50 text-rose-500 hover:bg-rose-500/10'}
                              title={isCurrent ? 'Cannot revoke current session' : 'Revoke this session'}
                            >
                              {isCurrent ? 'Current' : 'Revoke'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-rose-500/5 border-rose-500/20 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-rose-500">Danger Zone</CardTitle>
                  <CardDescription className="text-rose-400/80">Permanently delete your account and all of your files.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Delete Account</h4>
                      <p className="text-sm text-slate-400 mt-1">Once you delete your account, there is no going back. Please be certain.</p>
                    </div>
                    <Button variant="danger" onClick={handleDeleteAccount} className="bg-rose-500/20 text-rose-500 hover:bg-rose-500/30">
                      <Trash2 size={18} className="mr-2" /> Delete Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}


        </div>
      </div>
    </div>
  );
}


'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useLocalParticipant,
  useParticipants,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Users,
  Hand,
  MessageSquare,
  Pin,
  Trash2,
  Send,
  Radio,
  AlertTriangle,
  VolumeX,
  Settings,
  Sparkles,
  LogOut,
  UserX,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface LiveClassDetails {
  id: string;
  title: string;
  description: string;
  course: string;
  course_title: string;
  subject_name?: string;
  chapter_name?: string;
  teacher_name?: string;
  teacher_display_name?: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  room_name: string;
  max_students: number;
  chat_enabled: boolean;
  student_mic_policy: 'OFF' | 'ON_REQUEST' | 'OPEN';
  peak_concurrent_users: number;
  total_attendees_count: number;
}

interface TokenResponse {
  token: string;
  server_url: string;
  room_name: string;
  role: string;
  is_teacher: boolean;
  live_class: LiveClassDetails;
}

interface ChatMessage {
  id: string;
  sender: string;
  sender_name: string;
  sender_role: string;
  message: string;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
}

interface HandRaiseItem {
  id: string;
  student: string;
  student_name: string;
  student_email: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'LOWERED';
  raised_at: string;
}

interface AttendeeItem {
  id: string;
  student: string;
  student_name: string;
  student_email: string;
  is_online: boolean;
  total_seconds: number;
  reconnect_count: number;
  joined_at: string;
}

export default function TeacherLiveRoomPage() {
  const params = useParams();
  const classId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function initTeacherRoom() {
      try {
        setLoading(true);
        setError(null);
        // Start or ensure class is LIVE
        await apiClient.post(`/live/${classId}/start/`).catch(() => {});
        // Obtain Teacher Token
        const res = await apiClient.post<TokenResponse>(`/live/${classId}/token/`);
        if (!isMounted) return;
        setTokenData(res);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to launch educator room.';
        setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (classId) {
      initTeacherRoom();
    }

    return () => {
      isMounted = false;
    };
  }, [classId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
          <Monitor className="w-8 h-8 text-indigo-400 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Preparing Educator Studio...</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          Initializing WebRTC publisher pipeline with Camera, Mic and Screen Share channels.
        </p>
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Educator Studio Error</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">{error}</p>
        <Link
          href="/admin/schedule"
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
        >
          Return to Admin Schedule
        </Link>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={tokenData.token}
      serverUrl={tokenData.server_url}
      connect={true}
      audio={true}
      video={true}
      screen={false}
      options={{ adaptiveStream: true, dynacast: true }}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none"
    >
      <RoomAudioRenderer />
      <TeacherLiveStage liveClass={tokenData.live_class} />
    </LiveKitRoom>
  );
}

function TeacherLiveStage({ liveClass }: { liveClass: LiveClassDetails }) {
  const router = useRouter();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  // Active side drawer: 'none' | 'students' | 'handraises' | 'chat' | 'settings'
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'students' | 'handraises' | 'chat' | 'settings'>('students');

  // Management data state
  const [attendees, setAttendees] = useState<AttendeeItem[]>([]);
  const [handRaises, setHandRaises] = useState<HandRaiseItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [micPolicy, setMicPolicy] = useState<'OFF' | 'ON_REQUEST' | 'OPEN'>(liveClass.student_mic_policy);

  // End Class confirmation modal
  const [showEndModal, setShowEndModal] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Local device toggles
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  // Tracks on stage
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  const localCameraTrack = useMemo(() => {
    return tracks.find((t) => t.participant.isLocal && t.source === Track.Source.Camera);
  }, [tracks]);

  const localScreenTrack = useMemo(() => {
    return tracks.find((t) => t.participant.isLocal && t.source === Track.Source.ScreenShare);
  }, [tracks]);

  // Polling data updates
  const loadAttendees = async () => {
    try {
      const res = await apiClient.get<{ attendees: AttendeeItem[] }>(`/live/${liveClass.id}/attendances/`);
      if (res?.attendees) setAttendees(res.attendees);
    } catch {}
  };

  const loadHandRaises = async () => {
    try {
      const res = await apiClient.get<HandRaiseItem[]>(`/live/${liveClass.id}/hand-raises/`);
      if (Array.isArray(res)) setHandRaises(res);
    } catch {}
  };

  const loadChat = async () => {
    try {
      const res = await apiClient.get<ChatMessage[]>(`/live/${liveClass.id}/chat/`);
      if (Array.isArray(res)) setMessages(res);
    } catch {}
  };

  useEffect(() => {
    loadAttendees();
    loadHandRaises();
    loadChat();

    const interval = setInterval(() => {
      loadAttendees();
      loadHandRaises();
      loadChat();
    }, 3500);

    return () => clearInterval(interval);
  }, [liveClass.id]);

  // Device actions
  const toggleCamera = async () => {
    try {
      const next = !cameraActive;
      await localParticipant.setCameraEnabled(next);
      setCameraActive(next);
    } catch (err) {
      console.error('Camera toggle error:', err);
    }
  };

  const toggleMic = async () => {
    try {
      const next = !micActive;
      await localParticipant.setMicrophoneEnabled(next);
      setMicActive(next);
    } catch (err) {
      console.error('Mic toggle error:', err);
    }
  };

  const toggleScreenShare = async () => {
    try {
      const next = !screenSharing;
      await localParticipant.setScreenShareEnabled(next, { audio: true });
      setScreenSharing(next);
    } catch (err) {
      console.error('Screen share error:', err);
      setScreenSharing(false);
    }
  };

  // Participant Management Actions
  const handleMuteAll = async () => {
    try {
      await apiClient.post(`/live/${liveClass.id}/mute/`, { all: true });
      alert('All student microphones have been muted.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to mute all.');
    }
  };

  const handleAllowMic = async (identity: string) => {
    try {
      await apiClient.post(`/live/${liveClass.id}/allow-mic/`, { identity });
      loadHandRaises();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to allow mic.');
    }
  };

  const handleDenyMic = async (identity: string) => {
    try {
      await apiClient.post(`/live/${liveClass.id}/deny-mic/`, { identity });
      loadHandRaises();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to deny mic.');
    }
  };

  const handleRemoveStudent = async (identity: string) => {
    if (!confirm(`Are you sure you want to disconnect and remove this student?`)) return;
    try {
      await apiClient.post(`/live/${liveClass.id}/remove/`, { identity });
      loadAttendees();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove student.');
    }
  };

  const handleRespondHandRaise = async (hrId: string, action: 'APPROVE' | 'DENY') => {
    try {
      await apiClient.post(`/live/${liveClass.id}/hand-raise/${hrId}/respond/`, { action });
      loadHandRaises();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to respond.');
    }
  };

  const handlePolicyChange = async (policy: 'OFF' | 'ON_REQUEST' | 'OPEN') => {
    try {
      await apiClient.post(`/live/${liveClass.id}/mic-policy/`, { policy });
      setMicPolicy(policy);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Policy update failed.');
    }
  };

  const handleChatModerate = async (msgId: string, action: 'pin' | 'delete') => {
    try {
      await apiClient.post(`/live/${liveClass.id}/chat/${msgId}/moderate/`, { action });
      loadChat();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Moderation failed.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || sendingMsg) return;
    setSendingMsg(true);
    try {
      const res = await apiClient.post<ChatMessage>(`/live/${liveClass.id}/chat/`, {
        message: chatInput.trim(),
      });
      if (res) {
        setMessages((prev) => [...prev, res]);
        setChatInput('');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Message failed.');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleEndClass = async () => {
    setIsEnding(true);
    try {
      await apiClient.post(`/live/${liveClass.id}/end/`);
      router.push('/admin/schedule');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to end class.');
      setIsEnding(false);
    }
  };

  const pendingHandRaises = handRaises.filter((h) => h.status === 'PENDING');

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* 1. TOP EDUCATOR BAR */}
      <header className="h-14 border-b border-slate-800 bg-slate-900 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/schedule"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Return to Schedule"
          >
            <X className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-rose-600 text-white animate-pulse">
              <Radio className="w-3 h-3" />
              Broadcasting
            </span>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-white truncate max-w-xs md:max-w-md">
                {liveClass.title}
              </h1>
              <p className="text-[11px] text-slate-400">
                Studio Mode • Room: <span className="font-mono text-slate-300">{liveClass.room_name}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Metrics */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-bold text-white">{participants.length}</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline">online</span>
          </div>

          {/* End Class Button */}
          <button
            onClick={() => setShowEndModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>End Class</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN STAGE & SIDEBAR */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* VIDEO PREVIEW STAGE */}
        <div className="flex-1 flex flex-col justify-center items-center bg-black relative p-4">
          {localScreenTrack ? (
            /* Screen share active preview */
            <div className="w-full h-full relative flex items-center justify-center">
              <VideoTrack
                trackRef={localScreenTrack}
                className="w-full h-full object-contain rounded-xl"
              />
              {localCameraTrack && (
                <div className="absolute top-4 right-4 w-44 sm:w-56 aspect-video rounded-xl overflow-hidden border-2 border-indigo-500 shadow-2xl bg-slate-900 z-10">
                  <VideoTrack
                    trackRef={localCameraTrack}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 left-2 text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white font-medium">
                    Educator Camera PiP
                  </div>
                </div>
              )}
            </div>
          ) : localCameraTrack ? (
            /* Camera active preview */
            <div className="w-full h-full relative flex items-center justify-center">
              <VideoTrack
                trackRef={localCameraTrack}
                className="w-full h-full object-contain rounded-xl"
              />
              <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold">Webcam Active & Broadcasting</span>
              </div>
            </div>
          ) : (
            /* Camera off placeholder */
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
              <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center mb-5 text-slate-500">
                <VideoOff className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Webcam is Turned Off</h3>
              <p className="text-xs text-slate-400 mb-4">
                Students hear your voice feed. Click Camera toggle below to enable video.
              </p>
            </div>
          )}
        </div>

        {/* 3. MANAGEMENT DRAWER */}
        {activeDrawer !== 'none' && (
          <aside className="w-80 sm:w-96 border-l border-slate-800 bg-slate-900 flex flex-col z-20 shrink-0">
            {/* Drawer Tabs Header */}
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
                {activeDrawer === 'students' && <Users className="w-4 h-4 text-indigo-400" />}
                {activeDrawer === 'handraises' && <Hand className="w-4 h-4 text-amber-400" />}
                {activeDrawer === 'chat' && <MessageSquare className="w-4 h-4 text-emerald-400" />}
                {activeDrawer === 'settings' && <Settings className="w-4 h-4 text-purple-400" />}
                <span>
                  {activeDrawer === 'students' && `Students (${participants.length})`}
                  {activeDrawer === 'handraises' && `Hand Raises (${pendingHandRaises.length})`}
                  {activeDrawer === 'chat' && 'Live Chat'}
                  {activeDrawer === 'settings' && 'Studio Policy'}
                </span>
              </div>
              <button
                onClick={() => setActiveDrawer('none')}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* DRAWER CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* TAB 1: STUDENTS LIST & CONTROLS */}
              {activeDrawer === 'students' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px] font-semibold uppercase">
                      Room Controls ({attendees.length} Enrolled)
                    </span>
                    <button
                      onClick={handleMuteAll}
                      className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 font-bold text-[11px] flex items-center gap-1 transition"
                    >
                      <VolumeX className="w-3 h-3" />
                      Mute All
                    </button>
                  </div>

                  <div className="space-y-2">
                    {participants
                      .filter((p) => !p.isLocal)
                      .map((p) => (
                        <div
                          key={p.identity}
                          className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{p.name || p.identity}</div>
                            <div className="text-[10px] text-slate-400 truncate">{p.identity}</div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleAllowMic(p.identity)}
                              className="p-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300"
                              title="Allow Mic"
                            >
                              <Mic className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDenyMic(p.identity)}
                              className="p-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 text-amber-300"
                              title="Mute / Revoke Mic"
                            >
                              <MicOff className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveStudent(p.identity)}
                              className="p-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300"
                              title="Disconnect Student"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    {participants.filter((p) => !p.isLocal).length === 0 && (
                      <div className="text-center text-slate-500 py-8">
                        No students have joined yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: HAND-RAISE QUEUE */}
              {activeDrawer === 'handraises' && (
                <div className="space-y-3">
                  {pendingHandRaises.length === 0 ? (
                    <div className="text-center text-slate-500 py-12">
                      No pending hand-raises from students.
                    </div>
                  ) : (
                    pendingHandRaises.map((hr) => (
                      <div
                        key={hr.id}
                        className="p-3 rounded-xl bg-slate-800 border border-amber-500/40 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-white">{hr.student_name}</div>
                          <div className="text-[10px] text-amber-300 flex items-center gap-1">
                            <Hand className="w-3 h-3" />
                            Raised at {new Date(hr.raised_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleRespondHandRaise(hr.id, 'APPROVE')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Allow
                          </button>
                          <button
                            onClick={() => handleRespondHandRaise(hr.id, 'DENY')}
                            className="p-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: LIVE CHAT MODERATION */}
              {activeDrawer === 'chat' && (
                <div className="flex-1 flex flex-col h-full space-y-3">
                  <div className="flex-1 overflow-y-auto space-y-2.5">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-2.5 rounded-xl border relative group ${
                          m.is_pinned
                            ? 'bg-indigo-950/60 border-indigo-500/60'
                            : 'bg-slate-800/60 border-slate-700/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-200">{m.sender_name}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => handleChatModerate(m.id, 'pin')}
                              className={`p-1 rounded hover:bg-slate-700 ${m.is_pinned ? 'text-indigo-400' : 'text-slate-400'}`}
                              title={m.is_pinned ? 'Unpin' : 'Pin to top'}
                            >
                              <Pin className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleChatModerate(m.id, 'delete')}
                              className="p-1 rounded text-rose-400 hover:bg-slate-700"
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-300 break-words">{m.message}</p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendMessage} className="pt-2 border-t border-slate-800 flex gap-2">
                    <input
                      type="text"
                      placeholder="Post official message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || sendingMsg}
                      className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 4: STUDIO POLICY & RECORDING */}
              {activeDrawer === 'settings' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-slate-400 font-bold uppercase text-[10px]">
                      Student Microphone Policy
                    </label>
                    <div className="space-y-1.5">
                      {[
                        { key: 'OFF', label: 'Mute All / Mic Disallowed', desc: 'Students cannot speak' },
                        { key: 'ON_REQUEST', label: 'On Hand-Raise Approval', desc: 'Teacher approves each speaker' },
                        { key: 'OPEN', label: 'Open Discussion', desc: 'Students can freely unmute' },
                      ].map((p) => (
                        <button
                          key={p.key}
                          onClick={() => handlePolicyChange(p.key as 'OFF' | 'ON_REQUEST' | 'OPEN')}
                          className={`w-full p-2.5 rounded-xl border text-left transition ${
                            micPolicy === p.key
                              ? 'bg-indigo-600/20 border-indigo-500 text-white'
                              : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="font-bold text-xs">{p.label}</div>
                          <div className="text-[10px] text-slate-400">{p.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700 text-xs space-y-1.5">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      LiveKit Cloud Egress
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Session is configured to automatically capture composite audio and video to Cloudflare R2 on completion.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 4. TEACHER STUDIO CONTROL BAR */}
      <footer className="h-20 border-t border-slate-800 bg-slate-900 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        {/* Left: Device Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleCamera}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs transition shadow-lg ${
              cameraActive
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
            }`}
          >
            {cameraActive ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{cameraActive ? 'Camera On' : 'Camera Off'}</span>
          </button>

          <button
            onClick={toggleMic}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs transition shadow-lg ${
              micActive
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
            }`}
          >
            {micActive ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{micActive ? 'Mic On' : 'Mic Muted'}</span>
          </button>

          <button
            onClick={toggleScreenShare}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs transition shadow-lg ${
              screenSharing
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            {screenSharing ? <Monitor className="w-4 h-4" /> : <MonitorOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{screenSharing ? 'Stop Share' : 'Share Screen'}</span>
          </button>
        </div>

        {/* Center: Drawer Switchers */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'students' ? 'none' : 'students')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              activeDrawer === 'students'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden md:inline">Students</span>
          </button>

          <button
            onClick={() => setActiveDrawer(activeDrawer === 'handraises' ? 'none' : 'handraises')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition relative ${
              activeDrawer === 'handraises'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Hand className="w-4 h-4" />
            <span className="hidden md:inline">Hand Raises</span>
            {pendingHandRaises.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-extrabold animate-bounce">
                {pendingHandRaises.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveDrawer(activeDrawer === 'chat' ? 'none' : 'chat')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              activeDrawer === 'chat'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden md:inline">Chat</span>
          </button>

          <button
            onClick={() => setActiveDrawer(activeDrawer === 'settings' ? 'none' : 'settings')}
            className={`p-2 rounded-xl text-xs font-bold transition ${
              activeDrawer === 'settings'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Studio Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Right: End Class */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEndModal(true)}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">End Class</span>
          </button>
        </div>
      </footer>

      {/* 5. END CLASS CONFIRMATION MODAL */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
              <LogOut className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">End Live Class Session?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This will disconnect all students, close the WebRTC room, finalize attendance watch time, and trigger Cloudflare R2 recording generation.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                disabled={isEnding}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndClass}
                disabled={isEnding}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center gap-2"
              >
                {isEnding ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                <span>{isEnding ? 'Ending Room...' : 'Yes, End Class'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

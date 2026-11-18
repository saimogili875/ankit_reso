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
  useConnectionState,
  useParticipants,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import {
  Mic,
  MicOff,
  Hand,
  MessageSquare,
  Users,
  LogOut,
  Radio,
  Wifi,
  WifiOff,
  AlertCircle,
  Pin,
  Send,
  X,
  Volume2,
  VolumeX,
  Loader2,
  Lock,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';

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
  sender_name: string;
  sender_role: string;
  message: string;
  is_pinned: boolean;
  created_at: string;
}

export default function StudentLiveRoomPage() {
  const params = useParams();
  const classId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchToken() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.post<TokenResponse>(`/live/${classId}/token/`);
        if (!isMounted) return;
        setTokenData(res);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to join the live session.';
        setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (classId) {
      fetchToken();
    }

    return () => {
      isMounted = false;
    };
  }, [classId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
          <Radio className="w-8 h-8 text-rose-500 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Connecting to Secure Classroom...</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          Verifying your course enrollment credentials and initializing WebRTC stream.
        </p>
        <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
      </div>
    );
  }

  if (error || !tokenData) {
    const isEnrollmentError = error?.toLowerCase().includes('enrolled') || error?.includes('403');
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-400">
          {isEnrollmentError ? <Lock className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {isEnrollmentError ? 'Course Enrollment Required' : 'Unable to Join Live Class'}
        </h2>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          {error || 'This live class is available only to actively enrolled students.'}
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/schedule"
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Back to Schedule
          </Link>
          <Link
            href="/courses"
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30"
          >
            Explore Courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={tokenData.token}
      serverUrl={tokenData.server_url}
      connect={true}
      audio={false}
      video={false}
      screen={false}
      options={{ adaptiveStream: true, dynacast: true }}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none"
    >
      <RoomAudioRenderer />
      <StudentLiveStage liveClass={tokenData.live_class} />
    </LiveKitRoom>
  );
}

function StudentLiveStage({ liveClass }: { liveClass: LiveClassDetails }) {
  const router = useRouter();
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  // Chat & Drawer state
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Hand raise state
  const [handRaised, setHandRaised] = useState(false);
  const [handRaiseId, setHandRaiseId] = useState<string | null>(null);
  const [isMicAllowed, setIsMicAllowed] = useState(liveClass.student_mic_policy === 'OPEN');
  const [audioOnly, setAudioOnly] = useState(false);

  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  // Find educator tracks
  const screenShareTrack = useMemo(() => {
    return tracks.find((t) => t.source === Track.Source.ScreenShare);
  }, [tracks]);

  const teacherCameraTrack = useMemo(() => {
    return tracks.find(
      (t) =>
        t.source === Track.Source.Camera &&
        (t.participant.identity.startsWith('teacher_') || t.participant.isSpeaking !== undefined)
    );
  }, [tracks]);

  // Poll chat messages
  useEffect(() => {
    let isMounted = true;
    async function loadChat() {
      try {
        const res = await apiClient.get<ChatMessage[]>(`/live/${liveClass.id}/chat/`);
        if (isMounted && Array.isArray(res)) {
          setMessages(res);
        }
      } catch {
        // silent fail in polling
      }
    }

    loadChat();
    const interval = setInterval(loadChat, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [liveClass.id]);

  // Poll hand raise & mic permission status
  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      try {
        const hrList = await apiClient.get<{ id: string; status: string }[]>(`/live/${liveClass.id}/hand-raises/`);
        if (isMounted && Array.isArray(hrList)) {
          const myHr = hrList.find((h) => h.id === handRaiseId);
          if (myHr) {
            if (myHr.status === 'APPROVED') {
              setIsMicAllowed(true);
            } else if (myHr.status === 'DENIED' || myHr.status === 'LOWERED') {
              setIsMicAllowed(liveClass.student_mic_policy === 'OPEN');
              if (myHr.status === 'LOWERED') setHandRaised(false);
            }
          }
        }
      } catch {
        // silent
      }
    }

    const interval = setInterval(checkStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [liveClass.id, handRaiseId, liveClass.student_mic_policy]);

  const toggleMic = async () => {
    if (!isMicAllowed) return;
    try {
      if (localParticipant.isMicrophoneEnabled) {
        await localParticipant.setMicrophoneEnabled(false);
      } else {
        await localParticipant.setMicrophoneEnabled(true);
      }
    } catch (err) {
      console.error('Failed to toggle mic:', err);
    }
  };

  const handleHandRaiseToggle = async () => {
    try {
      const res = await apiClient.post<{ id?: string; status?: string }>(`/live/${liveClass.id}/hand-raise/`);
      if (res?.status === 'LOWERED') {
        setHandRaised(false);
        setHandRaiseId(null);
      } else {
        setHandRaised(true);
        if (res?.id) setHandRaiseId(res.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Hand raise failed.';
      alert(msg);
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
      const msg = err instanceof Error ? err.message : 'Message failed to send.';
      alert(msg);
    } finally {
      setSendingMsg(false);
    }
  };

  const pinnedMsg = messages.find((m) => m.is_pinned);

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* 1. TOP HEADER */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/schedule"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Leave Classroom"
          >
            <LogOut className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-rose-500 text-white animate-pulse">
              <Radio className="w-3 h-3" />
              Live
            </span>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-white truncate max-w-xs md:max-w-md">
                {liveClass.title}
              </h1>
              <p className="text-[11px] text-slate-400">
                {liveClass.teacher_display_name || 'Faculty Educator'} • {liveClass.course_title}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px]">
            {connectionState === ConnectionState.Connected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 hidden md:inline">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300 hidden md:inline">Reconnecting...</span>
              </>
            )}
          </div>

          {/* Participant count */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 font-medium">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>{participants.length}</span>
          </div>

          {/* Mobile Chat Toggle Button */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`p-2 rounded-lg border transition ${
              chatOpen
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. MAIN STAGE & SIDEBAR */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* VIDEO DISPLAY AREA */}
        <div className="flex-1 flex flex-col justify-center items-center bg-black relative p-2 sm:p-4">
          {screenShareTrack && !audioOnly ? (
            /* Screen Share Primary View with PiP Camera */
            <div className="w-full h-full relative flex items-center justify-center">
              <VideoTrack
                trackRef={screenShareTrack}
                className="w-full h-full object-contain rounded-xl"
              />
              {teacherCameraTrack && (
                <div className="absolute top-4 right-4 w-44 sm:w-56 aspect-video rounded-xl overflow-hidden border-2 border-indigo-500/80 shadow-2xl bg-slate-900 z-10">
                  <VideoTrack
                    trackRef={teacherCameraTrack}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 left-2 text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white font-medium">
                    {liveClass.teacher_display_name || 'Educator'}
                  </div>
                </div>
              )}
            </div>
          ) : teacherCameraTrack && !audioOnly ? (
            /* Teacher Camera Primary View */
            <div className="w-full h-full relative flex items-center justify-center">
              <VideoTrack
                trackRef={teacherCameraTrack}
                className="w-full h-full object-contain rounded-xl"
              />
              <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold">{liveClass.teacher_display_name || 'Educator'}</span>
              </div>
            </div>
          ) : (
            /* Audio Only or Educator Waiting Card */
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-rose-500/20 to-indigo-500/20 border-2 border-rose-500/40 flex items-center justify-center mb-5 relative">
                <Radio className="w-10 h-10 text-rose-400 animate-pulse" />
                <div className="absolute inset-0 rounded-full border border-rose-500/20 animate-ping" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                {audioOnly ? 'Low-Bandwidth Audio Mode Active' : 'Educator Camera Paused'}
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                {audioOnly
                  ? 'Video stream is paused to save data. Audio playback remains active.'
                  : 'Listening to live audio feed from the educator.'}
              </p>
              <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">
                <Volume2 className="w-3.5 h-3.5 mr-1 text-emerald-400 animate-pulse" />
                Audio Streaming Live
              </Badge>
            </div>
          )}

          {/* Pinned Announcement Bar */}
          {pinnedMsg && (
            <div className="absolute top-4 left-4 right-4 sm:left-6 sm:right-6 max-w-2xl mx-auto bg-indigo-950/90 border border-indigo-500/50 backdrop-blur-md rounded-xl p-3 flex items-start gap-2.5 shadow-xl z-20">
              <Pin className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 rotate-45" />
              <div className="flex-1 text-xs">
                <div className="font-bold text-indigo-200">Educator Announcement</div>
                <div className="text-indigo-100">{pinnedMsg.message}</div>
              </div>
            </div>
          )}
        </div>

        {/* 3. RIGHT SIDE LIVE CHAT DRAWER */}
        {chatOpen && (
          <aside className="w-80 sm:w-96 border-l border-slate-800 bg-slate-900/95 flex flex-col z-20 shrink-0">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Live Discussion</span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {messages.length === 0 ? (
                <div className="text-center text-slate-500 py-12">
                  No messages yet. Ask a question or share your learning!
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-xl border ${
                      m.sender_role === 'TEACHER'
                        ? 'bg-rose-950/40 border-rose-500/30'
                        : 'bg-slate-800/60 border-slate-700/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`font-bold ${
                          m.sender_role === 'TEACHER' ? 'text-rose-400' : 'text-slate-300'
                        }`}
                      >
                        {m.sender_name}
                      </span>
                      {m.sender_role === 'TEACHER' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          Teacher
                        </span>
                      )}
                    </div>
                    <p className="text-slate-200 break-words">{m.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                placeholder={liveClass.chat_enabled ? 'Type your doubt or comment...' : 'Chat disabled'}
                disabled={!liveClass.chat_enabled || sendingMsg}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!liveClass.chat_enabled || sendingMsg || !chatInput.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* 4. STUDENT BOTTOM CONTROL BAR */}
      <footer className="h-20 border-t border-slate-800 bg-slate-900/90 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        {/* Left: Info status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAudioOnly(!audioOnly)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              audioOnly
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Toggle data saving mode"
          >
            {audioOnly ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{audioOnly ? 'Data Saver Active' : 'Normal Stream'}</span>
          </button>
        </div>

        {/* Center: Microphone & Hand Raise Controls */}
        <div className="flex items-center gap-3">
          {/* Microphone Button (Strictly Controlled by Teacher/Policy) */}
          <div className="relative group">
            <button
              onClick={toggleMic}
              disabled={!isMicAllowed}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-lg ${
                !isMicAllowed
                  ? 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-75'
                  : localParticipant.isMicrophoneEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
              }`}
            >
              {localParticipant.isMicrophoneEnabled && isMicAllowed ? (
                <>
                  <Mic className="w-4 h-4 animate-bounce" />
                  <span>Mute Mic</span>
                </>
              ) : (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>{isMicAllowed ? 'Unmute Mic' : 'Muted by Teacher'}</span>
                </>
              )}
            </button>
            {!isMicAllowed && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-950 text-slate-300 text-[11px] px-2.5 py-1 rounded-lg border border-slate-800 shadow-xl whitespace-nowrap z-30">
                Raise hand to request speaking permission
              </div>
            )}
          </div>

          {/* Raise Hand Button */}
          <button
            onClick={handleHandRaiseToggle}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-lg ${
              handRaised
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <Hand className={`w-4 h-4 ${handRaised ? 'text-amber-200' : 'text-slate-300'}`} />
            <span>{handRaised ? 'Hand Raised' : 'Raise Hand'}</span>
          </button>
        </div>

        {/* Right: Leave Classroom */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/schedule')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-bold transition shadow-lg"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Leave Class</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

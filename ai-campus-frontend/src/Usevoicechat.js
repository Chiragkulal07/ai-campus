import { useCallback, useEffect, useRef, useState } from 'react';

// Global voice + video chat over a mesh of WebRTC peer connections.
export default function useVoiceChat(socket) {
  const [isMicOn, setIsMicOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [speakingPeerIds, setSpeakingPeerIds] = useState([]);
  const [micError, setMicError] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [remoteVideoStreams, setRemoteVideoStreams] = useState({});

  const localAudioStreamRef = useRef(null);
  const localVideoStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const transceiversRef = useRef(new Map());
  const audioElementsRef = useRef(new Map());
  const analysersRef = useRef(new Map());
  const pendingPlayRef = useRef(new Set());

  const politeRef = useRef(new Map());
  const makingOfferRef = useRef(new Map());

  const getIceServers = () => {
    const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
    const turnUrl = import.meta.env?.VITE_TURN_URL;
    const turnUsername = import.meta.env?.VITE_TURN_USERNAME;
    const turnCredential = import.meta.env?.VITE_TURN_CREDENTIAL;

    if (turnUrl && turnUsername && turnCredential) {
      servers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
    } else if (import.meta.env?.PROD) {
      console.warn('[voiceChat] No TURN server configured. Calls across restrictive NATs may fail.');
    }
    return servers;
  };

  // ── Force-retry any blocked audio elements — used both by the generic
  // document-wide listener below, AND explicitly inside the mic button
  // click itself, since that click is a guaranteed real user gesture. ──
  const unlockPendingAudio = () => {
    pendingPlayRef.current.forEach((audioEl) => {
      audioEl.play()
        .then(() => {
          console.log('[voiceChat] pending audio unlocked for', audioEl.dataset.peerId);
          pendingPlayRef.current.delete(audioEl);
        })
        .catch((err) => {
          console.warn('[voiceChat] still blocked for', audioEl.dataset.peerId, err.message);
        });
    });
  };

  useEffect(() => {
    document.addEventListener('click', unlockPendingAudio);
    document.addEventListener('keydown', unlockPendingAudio);
    document.addEventListener('touchstart', unlockPendingAudio);
    return () => {
      document.removeEventListener('click', unlockPendingAudio);
      document.removeEventListener('keydown', unlockPendingAudio);
      document.removeEventListener('touchstart', unlockPendingAudio);
    };
  }, []);

  const playAudioElement = (audioEl, peerId) => {
    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise
        .then(() => console.log('[voiceChat] audio playing for', peerId))
        .catch((err) => {
          console.warn('[voiceChat] autoplay BLOCKED for', peerId, '-', err.message, '- will retry on next click');
          pendingPlayRef.current.add(audioEl);
        });
    }
  };

  const stopWatchingVolume = (peerId) => {
    const entry = analysersRef.current.get(peerId);
    if (entry) {
      if (entry.rafId) cancelAnimationFrame(entry.rafId);
      if (entry.audioCtx && entry.audioCtx.state !== 'closed') {
        entry.audioCtx.close().catch(() => {});
      }
    }
    analysersRef.current.delete(peerId);
    setSpeakingPeerIds((prev) => prev.filter((id) => id !== peerId));
  };

  const watchVolume = (peerId, stream) => {
    if (!(stream instanceof MediaStream) || stream.getAudioTracks().length === 0) return;
    stopWatchingVolume(peerId);

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // Some browsers create AudioContext in a "suspended" state until a
      // user gesture explicitly resumes it — this doesn't block the
      // separate <audio> element's playback, but does block the speaking-
      // detection analyser, so we resume it defensively here too.
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const check = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;

        setSpeakingPeerIds((prev) => {
          const isSpeaking = avg > 12;
          const already = prev.includes(peerId);
          if (isSpeaking && !already) return [...prev, peerId];
          if (!isSpeaking && already) return prev.filter((id) => id !== peerId);
          return prev;
        });

        const rafId = requestAnimationFrame(check);
        const entry = analysersRef.current.get(peerId);
        if (entry) entry.rafId = rafId;
      };

      analysersRef.current.set(peerId, { rafId: null, audioCtx });
      check();
    } catch (err) {
      console.warn('[voiceChat] volume watch failed for', peerId, err);
    }
  };

  const clearRemoteVideo = (peerId) => {
    setRemoteVideoStreams((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  };

  const createPeerConnection = useCallback((peerId) => {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });

    politeRef.current.set(peerId, socket.id < peerId);
    makingOfferRef.current.set(peerId, false);

    let audioTransceiver;
    if (localAudioStreamRef.current) {
      const track = localAudioStreamRef.current.getAudioTracks()[0];
      audioTransceiver = pc.addTransceiver(track, { direction: 'sendrecv', streams: [localAudioStreamRef.current] });
    } else {
      audioTransceiver = pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    let videoTransceiver;
    if (localVideoStreamRef.current) {
      const track = localVideoStreamRef.current.getVideoTracks()[0];
      videoTransceiver = pc.addTransceiver(track, { direction: 'sendrecv', streams: [localVideoStreamRef.current] });
    } else {
      videoTransceiver = pc.addTransceiver('video', { direction: 'recvonly' });
    }

    transceiversRef.current.set(peerId, { audio: audioTransceiver, video: videoTransceiver });

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current.set(peerId, true);
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        socket.emit('voice:signal', { to: peerId, data: { sdp: pc.localDescription } });
      } catch (err) {
        console.warn('[voiceChat] negotiation failed for', peerId, err);
      } finally {
        makingOfferRef.current.set(peerId, false);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice:signal', { to: peerId, data: { candidate: event.candidate } });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[voiceChat] ICE state for', peerId, '->', pc.iceConnectionState);
      if (['failed', 'disconnected'].includes(pc.iceConnectionState)) {
        console.warn(`[voiceChat] ICE ${pc.iceConnectionState} for peer`, peerId);
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      console.log('[voiceChat] ontrack fired — kind:', event.track.kind, 'from peer:', peerId);

      if (event.track.kind === 'audio') {
        let audioEl = audioElementsRef.current.get(peerId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          audioEl.dataset.peerId = peerId;
          document.body.appendChild(audioEl);
          audioElementsRef.current.set(peerId, audioEl);
        }
        audioEl.srcObject = remoteStream;
        playAudioElement(audioEl, peerId);
        watchVolume(peerId, remoteStream);
        event.track.addEventListener('ended', () => stopWatchingVolume(peerId));
      } else if (event.track.kind === 'video') {
        setRemoteVideoStreams((prev) => ({ ...prev, [peerId]: remoteStream }));
        event.track.addEventListener('ended', () => clearRemoteVideo(peerId));
      }
    };

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  }, [socket]);

  const closePeerConnection = (peerId) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    transceiversRef.current.delete(peerId);
    politeRef.current.delete(peerId);
    makingOfferRef.current.delete(peerId);

    const audioEl = audioElementsRef.current.get(peerId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.remove();
      audioElementsRef.current.delete(peerId);
      pendingPlayRef.current.delete(audioEl);
    }
    stopWatchingVolume(peerId);
    clearRemoteVideo(peerId);
  };

  useEffect(() => {
    if (!socket) return;
    socket.emit('voice:join');

    return () => {
      socket.emit('voice:leave');
      peerConnectionsRef.current.forEach((_, peerId) => closePeerConnection(peerId));
      peerConnectionsRef.current.clear();

      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getTracks().forEach((t) => t.stop());
        localAudioStreamRef.current = null;
      }
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
        localVideoStreamRef.current = null;
      }
      setSpeakingPeerIds([]);
      setRemoteVideoStreams({});
      setIsMicOn(false);
      setIsVideoOn(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleExistingParticipants = (existingIds) => {
      existingIds.forEach((peerId) => {
        if (!peerConnectionsRef.current.has(peerId)) {
          createPeerConnection(peerId);
        }
      });
    };

    const handlePeerJoined = () => {};

    const handleSignal = async ({ from, data }) => {
      let pc = peerConnectionsRef.current.get(from);
      if (!pc) pc = createPeerConnection(from);

      const polite = politeRef.current.get(from);

      if (data.sdp) {
        const description = data.sdp;
        const offerCollision =
          description.type === 'offer' &&
          (makingOfferRef.current.get(from) || pc.signalingState !== 'stable');

        const ignoreOffer = !polite && offerCollision;
        if (ignoreOffer) return;

        try {
          await pc.setRemoteDescription(description);
          if (description.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice:signal', { to: from, data: { sdp: pc.localDescription } });
          }
        } catch (err) {
          console.warn('[voiceChat] failed handling sdp from', from, err);
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (err) {
          // Safe to ignore — usually a late candidate for a connection that moved on
        }
      }
    };

    const handlePeerLeft = ({ peerId }) => closePeerConnection(peerId);
    const handlePeerVideoStopped = ({ peerId }) => clearRemoteVideo(peerId);

    socket.on('voice:existing-participants', handleExistingParticipants);
    socket.on('voice:peer-joined', handlePeerJoined);
    socket.on('voice:signal', handleSignal);
    socket.on('voice:peer-left', handlePeerLeft);
    socket.on('voice:peer-video-stopped', handlePeerVideoStopped);

    return () => {
      socket.off('voice:existing-participants', handleExistingParticipants);
      socket.off('voice:peer-joined', handlePeerJoined);
      socket.off('voice:signal', handleSignal);
      socket.off('voice:peer-left', handlePeerLeft);
      socket.off('voice:peer-video-stopped', handlePeerVideoStopped);
    };
  }, [socket, createPeerConnection]);

  const toggleMic = async () => {
    if (!socket) return;
    setMicError(null);

    // This click is a guaranteed real user gesture — use it to force-retry
    // any audio elements that got blocked earlier, right now, not waiting
    // for the generic document-wide listener to catch up.
    unlockPendingAudio();

    if (isMicOn) {
      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
      }
      setIsMicOn(false);
      return;
    }

    if (!localAudioStreamRef.current) {
      try {
        console.log('[voiceChat] requesting microphone permission...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[voiceChat] microphone permission GRANTED, tracks:', stream.getAudioTracks().length);
        localAudioStreamRef.current = stream;
        const track = stream.getAudioTracks()[0];

        peerConnectionsRef.current.forEach((pc, peerId) => {
          const pair = transceiversRef.current.get(peerId);
          if (pair && pair.audio) {
            pair.audio.sender.replaceTrack(track);
            if (pair.audio.sender.setStreams) pair.audio.sender.setStreams(stream);
            pair.audio.direction = 'sendrecv';
            console.log('[voiceChat] upgraded audio transceiver to sendrecv for', peerId);
          } else {
            pc.addTrack(track, stream);
          }
        });
      } catch (err) {
        console.error('[voiceChat] microphone permission FAILED:', err.name, err.message);
        setMicError(
          err.name === 'NotAllowedError'
            ? 'Microphone access was denied. Check your browser permissions.'
            : 'Could not access your microphone. Please check your device settings.'
        );
        return;
      }
    } else {
      localAudioStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = true; });
    }

    setIsMicOn(true);
  };

  const toggleVideo = async () => {
    if (!socket) return;
    setVideoError(null);

    if (isVideoOn) {
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
        localVideoStreamRef.current = null;
      }
      peerConnectionsRef.current.forEach((pc, peerId) => {
        const pair = transceiversRef.current.get(peerId);
        if (pair && pair.video) {
          pair.video.sender.replaceTrack(null);
          pair.video.direction = 'recvonly';
        }
      });
      socket.emit('voice:video-stopped');
      setIsVideoOn(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      localVideoStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];

      peerConnectionsRef.current.forEach((pc, peerId) => {
        const pair = transceiversRef.current.get(peerId);
        if (pair && pair.video) {
          pair.video.sender.replaceTrack(track);
          if (pair.video.sender.setStreams) pair.video.sender.setStreams(stream);
          pair.video.direction = 'sendrecv';
        } else {
          pc.addTrack(track, stream);
        }
      });

      setIsVideoOn(true);
    } catch (err) {
      console.error('[voiceChat] camera permission failed:', err.message);
      setVideoError(
        err.name === 'NotAllowedError'
          ? 'Camera access was denied. Check your browser permissions.'
          : 'Could not access your camera. Please check your device settings.'
      );
    }
  };

  return {
    isMicOn, toggleMic, micError,
    isVideoOn, toggleVideo, videoError,
    speakingPeerIds, remoteVideoStreams,
    localVideoStream: localVideoStreamRef.current,
  };
}
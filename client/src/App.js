import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://one0-bank-1z4r.onrender.com";
let socket;

function App() {
  const [roomCode, setRoomCode] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [streams, setStreams] = useState({});
  
  const myVideoRef = useRef();
  const peersRef = useRef({});
  const localStreamRef = useRef();

  useEffect(() => {
    socket = io(BACKEND_URL);

    socket.on('user-connected', async (userId) => {
      const peerConnection = createPeerConnection(userId, socket);
      peersRef.current[userId] = peerConnection;

      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('offer', { target: userId, offer });
    });

    socket.on('offer', async ({ offer, sender }) => {
      const peerConnection = createPeerConnection(sender, socket);
      peersRef.current[sender] = peerConnection;

      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer', { target: sender, answer });
    });

    socket.on('answer', async ({ answer, sender }) => {
      const pc = peersRef.current[sender];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ candidate, sender }) => {
      const pc = peersRef.current[sender];
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('user-disconnected', (userId) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
      setStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[userId];
        return newStreams;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createPeerConnection = (userId, socketInstance) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketInstance.emit('ice-candidate', { target: userId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setStreams(prev => ({ ...prev, [userId]: event.streams[0] }));
    };

    return pc;
  };

 const joinRoom = async (e) => {
    e.preventDefault();
    if (!roomCode) return;

    try {
      // Jalqaba kaameeraa fi maayikiroofoonii gaafadhu
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" }, 
        audio: true 
      });
      
      localStreamRef.current = stream;
      
      // Viidiyoon calqabaa (Self) kallattiin akka qabatu godhi
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
        myVideoRef.current.play().catch(err => console.log("Play error:", err));
      }

      await fetch(`${BACKEND_URL}/api/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode })
      });

      socket.emit('join-room', roomCode);
      setInRoom(true);
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Kaameeraa ykn maayikiroofoonii argachuu hin danda'amne. Heeyyama mirkaneessi!");
    }
  };
  return (
    <div className="container">
      <h1>Aappii Sagalee fi Viidiyoo (Dhuunfaa & Garee)</h1>
      {!inRoom ? (
        <form onSubmit={joinRoom} className="join-form">
          <input 
            type="text" 
            placeholder="Koodii Kutaa Galchi (Fkn: room123)" 
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          />
          <button type="submit">Kutaa Seenii</button>
        </form>
      ) : (
        <div className="video-grid">
          <div className="video-box">
            <video ref={myVideoRef} autoPlay muted playsInline />
            <span>Ani (Self)</span>
          </div>
          {Object.entries(streams).map(([userId, stream]) => (
            <div className="video-box" key={userId}>
              <video 
                autoPlay 
                playsInline 
                ref={el => { if (el) el.srcObject = stream; }} 
              />
              <span>Hirmaataa</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://imaanaacall2.onrender.com";
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

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current);
        });
      }

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('offer', { target: userId, offer });
    });

    socket.on('offer', async ({ offer, sender }) => {
      const peerConnection = createPeerConnection(sender, socket);
      peersRef.current[sender] = peerConnection;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current);
        });
      }

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
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
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

  const startCall = async (e) => {
    e.preventDefault();
    if (!roomCode) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" }, 
        audio: true 
      });
      
      localStreamRef.current = stream;
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
        myVideoRef.current.play().catch(err => console.log(err));
      }

      socket.emit('join-room', roomCode);
      setInRoom(true);
    } catch (err) {
      alert("Kaameeraa ykn maayikiroofoonii argachuu hin danda'amne.");
    }
  };

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    setStreams({});
    setInRoom(false);
    window.location.reload();
  };

  return (
    <div className="container" style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Aappii Sagalee fi Viidiyoo (Call & WebRTC)</h1>
      {!inRoom ? (
        <form onSubmit={startCall} className="join-form">
          <input 
            type="text" 
            placeholder="Koodii Kutaa Galchi (Fkn: room123)" 
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', marginRight: '10px' }}
          />
          <button type="submit" style={{ padding: '10px 20px', background: 'green', color: 'white', border: 'none', cursor: 'pointer' }}>
            Call (Seeni)
          </button>
        </form>
      ) : (
        <div>
          <div className="video-grid" style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div className="video-box">
              <video ref={myVideoRef} autoPlay muted playsInline style={{ width: '300px', background: '#000', borderRadius: '8px' }} />
              <p>Ani (Self)</p>
            </div>
            {Object.entries(streams).map(([userId, stream]) => (
              <div className="video-box" key={userId}>
                <video 
                  autoPlay 
                  playsInline 
                  ref={el => { 
                    if (el && el.srcObject !== stream) {
                      el.srcObject = stream;
                      el.play().catch(e => console.log(e));
                    }
                  }} 
                  style={{ width: '300px', background: '#000', borderRadius: '8px' }}
                />
                <p>Hirmaataa</p>
              </div>
            ))}
          </div>
          <button onClick={endCall} style={{ padding: '12px 25px', background: 'red', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', cursor: 'pointer' }}>
            End Call (Cufi)
          </button>
        </div>
      )}
    </div>
  );
}

export default App;

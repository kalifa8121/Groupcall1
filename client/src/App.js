import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://imaanaacall2.onrender.com";
let socket;

function App() {
  const [roomCode, setRoomCode] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [callType, setCallType] = useState('video'); // 'video' ykn 'audio'
  const [streams, setStreams] = useState({});
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async ({ candidate, sender }) => {
      const pc = peersRef.current[sender];
      if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('receive-message', (data) => {
      setMessages(prev => [...prev, data]);
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

  const startCall = async (type) => {
    if (!roomCode) return;
    setCallType(type);

    try {
      const constraints = type === 'video' 
        ? { video: { facingMode: "user" }, audio: true }
        : { video: false, audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (type === 'video' && myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
        myVideoRef.current.play().catch(e => console.log(e));
      }

      await fetch(`${BACKEND_URL}/api/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode })
      });

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

  // Text Message Erguu
  const sendTextMessage = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const msgData = { type: 'text', content: textInput, sender: socket.id };
    socket.emit('send-message', { roomCode, messageData: msgData });
    setMessages(prev => [...prev, msgData]);
    setTextInput('');
  };

  // Sagalee Waraabuu (Voice Recording) Jalqabuu fi Xumuruu
  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const msgData = { type: 'audio', content: audioUrl, sender: socket.id };
        socket.emit('send-message', { roomCode, messageData: msgData });
        setMessages(prev => [...prev, msgData]);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Waraabbii sagalee jalqabuu hin danda'amne.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="container" style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Aappii Sagalee, Viidiyoo & Chat</h1>
      {!inRoom ? (
        <div className="join-form">
          <input 
            type="text" 
            placeholder="Koodii Kutaa Galchi (Fkn: room123)" 
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', marginRight: '10px' }}
          />
          <br/><br/>
          <button onClick={() => startCall('video')} style={{ padding: '10px 20px', background: 'green', color: 'white', border: 'none', marginRight: '10px', cursor: 'pointer' }}>
            Video Call Seenii
          </button>
          <button onClick={() => startCall('audio')} style={{ padding: '10px 20px', background: 'blue', color: 'white', border: 'none', cursor: 'pointer' }}>
            Voice Call Seenii
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {callType === 'video' && (
            <div className="video-grid" style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div className="video-box">
                <video ref={myVideoRef} autoPlay muted playsInline style={{ width: '250px', background: '#000', borderRadius: '8px' }} />
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
                    style={{ width: '250px', background: '#000', borderRadius: '8px' }}
                  />
                  <p>Hirmaataa</p>
                </div>
              ))}
            </div>
          )}

          {callType === 'audio' && (
            <h3>Voice Call irra jirtu... (Sagalee qofa)</h3>
          )}

          <button onClick={endCall} style={{ padding: '10px 20px', background: 'red', color: 'white', border: 'none', borderRadius: '5px', marginBottom: '20px', cursor: 'pointer' }}>
            End Call (Cufi)
          </button>

          {/* Chat & Voice Messaging Section */}
          <div className="chat-section" style={{ width: '100%', maxWidth: '400px', border: '1px solid #ccc', padding: '10px', borderRadius: '8px', background: '#f9f9f9' }}>
            <h3>Chat & Media Room</h3>
            <div style={{ height: '150px', overflowY: 'scroll', border: '1px solid #ddd', padding: '5px', marginBottom: '10px', background: '#fff', textAlign: 'left' }}>
              {messages.map((msg, index) => (
                <div key={index} style={{ margin: '5px 0' }}>
                  {msg.type === 'text' && <p><b>{msg.sender === socket.id ? 'Ani' : 'Hirmaataa'}:</b> {msg.content}</p>}
                  {msg.type === 'audio' && (
                    <div>
                      <p><b>{msg.sender === socket.id ? 'Ani' : 'Hirmaataa'} (Voice Note):</b></p>
                      <audio controls src={msg.content} style={{ width: '100%' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={sendTextMessage} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
              <input 
                type="text" 
                value={textInput} 
                onChange={e => setTextInput(e.target.value)} 
                placeholder="Ergaa barreessi..." 
                style={{ flex: 1, padding: '8px' }}
              />
              <button type="submit" style={{ padding: '8px 12px' }}>Ergi</button>
            </form>

            <div>
              {!isRecording ? (
                <button type="button" onClick={startRecording} style={{ background: 'purple', color: 'white', border: 'none', padding: '8px', width: '100%', cursor: 'pointer' }}>
                  🎙️ Sagalee Waraabuu Jalqabi
                </button>
              ) : (
                <button type="button" onClick={stopRecording} style={{ background: 'darkred', color: 'white', border: 'none', padding: '8px', width: '100%', cursor: 'pointer' }}>
                  ⏹️ Waraabbii Xumuri & Ergi
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

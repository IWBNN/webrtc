import React, { useEffect, useRef } from 'react';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import './App.css';

const App = () => {
  const localStreamRef = useRef(null);
  const audioRef = useRef(null);
  let peerConnection = useRef(null);
  let stompClient = useRef(null);

  useEffect(() => {
    const startStreaming = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;

        peerConnection.current = new RTCPeerConnection();
        stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

        peerConnection.current.ontrack = (event) => {
          audioRef.current.srcObject = event.streams[0];
        };

        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);

        connectToWebSocket(offer);

      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    };

    const connectToWebSocket = (offer) => {
      const socket = new SockJS('http://43.201.255.235/ws'); // EC2 퍼블릭 IP 주소로 변경
      stompClient.current = Stomp.over(socket);

      stompClient.current.connect({}, () => {
        stompClient.current.subscribe('/topic/offer', (message) => {
          const remoteOffer = JSON.parse(message.body);
          handleOffer(remoteOffer);
        });

        stompClient.current.subscribe('/topic/answer', (message) => {
          const remoteAnswer = JSON.parse(message.body);
          handleAnswer(remoteAnswer);
        });

        stompClient.current.send('/app/offer', {}, JSON.stringify(offer));
      });
    };

    const handleOffer = async (remoteOffer) => {
      if (!peerConnection.current) return;

      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteOffer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      stompClient.current.send('/app/answer', {}, JSON.stringify(answer));
    };

    const handleAnswer = async (remoteAnswer) => {
      if (!peerConnection.current) return;

      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
    };

    startStreaming();

    return () => {
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (stompClient.current) {
        stompClient.current.disconnect();
      }
    };
  }, []);

  return (
      <div className="App">
        <audio ref={audioRef} autoPlay></audio>
      </div>
  );
};

export default App;

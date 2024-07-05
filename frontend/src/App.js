import React, { useEffect, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import './App.css';

const App = () => {
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
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
          remoteStreamRef.current.addTrack(event.track);
          audioRef.current.srcObject = remoteStreamRef.current;
        };

        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);

        connectToWebSocket(offer);

      } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Microphone access denied or not available.');
      }
    };

    const connectToWebSocket = (offer) => {
      const socket = new SockJS('https://43.203.222.208/ws');
      stompClient.current = new Client({
        webSocketFactory: () => socket,
        debug: (str) => {
          console.log(str);
        },
        onConnect: () => {
          stompClient.current.subscribe('/topic/offer', (message) => {
            const remoteOffer = JSON.parse(message.body);
            handleOffer(remoteOffer);
          });

          stompClient.current.subscribe('/topic/answer', (message) => {
            const remoteAnswer = JSON.parse(message.body);
            handleAnswer(remoteAnswer);
          });

          stompClient.current.publish({ destination: '/app/offer', body: JSON.stringify(offer) });
        },
        onDisconnect: () => {
          console.log("Connection closed to https://43.203.222.208/ws");
        }
      });

      stompClient.current.activate();
    };

    const handleOffer = async (remoteOffer) => {
      if (!peerConnection.current) return;

      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteOffer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      stompClient.current.publish({ destination: '/app/answer', body: JSON.stringify(answer) });
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
        stompClient.current.deactivate();
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

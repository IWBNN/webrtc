import React, { useEffect, useRef, useState } from 'react';
import SockJS from 'sockjs-client';
import { Client as StompClient, IMessage } from '@stomp/stompjs';

const WebRTCComponent: React.FC = () => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const stompClientRef = useRef<StompClient | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const socket = new SockJS('http://43.200.253.198:8080/ws');
        const stompClient = new StompClient({
            webSocketFactory: () => socket as any,
            debug: (str) => console.log(str),
        });
        stompClientRef.current = stompClient;

        stompClient.onConnect = (frame) => {
            console.log('Connected: ' + frame);
            setConnected(true);
            stompClient.subscribe('/topic/messages', (message: IMessage) => {
                const data = JSON.parse(message.body);
                if (data.type === 'offer') {
                    handleOffer(data.offer);
                } else if (data.type === 'answer') {
                    handleAnswer(data.answer);
                } else if (data.type === 'candidate') {
                    handleCandidate(data.candidate);
                }
            });
        };

        stompClient.onStompError = (frame) => {
            console.error('Broker reported error: ' + frame.headers['message']);
            console.error('Additional details: ' + frame.body);
        };

        stompClient.activate();

        return () => {
            stompClient.deactivate();
        };
    }, []);

    const startLocalStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
        } catch (error) {
            console.error('Error accessing media devices.', error);
        }
    };

    const createPeerConnection = () => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        pc.onicecandidate = event => {
            if (event.candidate) {
                stompClientRef.current?.publish({
                    destination: '/app/candidate',
                    body: JSON.stringify({ candidate: event.candidate })
                });
            }
        };

        pc.ontrack = event => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pcRef.current = pc;
    };

    const handleOffer = async (offer: RTCSessionDescriptionInit) => {
        if (!pcRef.current) createPeerConnection();
        await pcRef.current!.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pcRef.current!.createAnswer();
        await pcRef.current!.setLocalDescription(answer);
        stompClientRef.current?.publish({
            destination: '/app/answer',
            body: JSON.stringify({ answer: answer })
        });
    };

    const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
        await pcRef.current!.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const handleCandidate = async (candidate: RTCIceCandidateInit) => {
        try {
            await pcRef.current!.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding received ice candidate', error);
        }
    };

    const createOffer = async () => {
        if (!pcRef.current) createPeerConnection();
        const offer = await pcRef.current!.createOffer();
        await pcRef.current!.setLocalDescription(offer);
        stompClientRef.current?.publish({
            destination: '/app/offer',
            body: JSON.stringify({ offer: offer })
        });
    };

    return (
        <div>
            <video ref={localVideoRef} autoPlay playsInline muted />
            <video ref={remoteVideoRef} autoPlay playsInline />
            <button onClick={startLocalStream}>Start Local Stream</button>
            <button onClick={createOffer} disabled={!connected}>Call</button>
        </div>
    );
};

export default WebRTCComponent;

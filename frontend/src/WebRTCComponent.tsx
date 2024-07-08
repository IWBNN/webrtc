import React, { useEffect, useRef, useState } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

const WebRTCComponent: React.FC = () => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const stompClientRef = useRef<any>(null);

    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const socket = new SockJS('https://54.180.160.104/ws');
        const stompClient = Stomp.over(socket);
        stompClientRef.current = stompClient;

        stompClient.connect({}, (frame: any) => {
            console.log('Connected: ' + frame);
            setConnected(true);

            stompClient.subscribe('/topic/offer', (message: any) => {
                const data = JSON.parse(message.body);
                handleOffer(data.offer, data.sender);
            });

            stompClient.subscribe('/topic/answer', (message: any) => {
                const data = JSON.parse(message.body);
                handleAnswer(data.answer, data.sender);
            });

            stompClient.subscribe('/topic/candidate', (message: any) => {
                const data = JSON.parse(message.body);
                handleCandidate(data.candidate, data.sender);
            });
        }, (error: any) => {
            console.error('Error: ' + error);
        });

        return () => {
            stompClient.disconnect();
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

    const createPeerConnection = (peerId: string) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                stompClientRef.current.send('/app/candidate', {}, JSON.stringify({ candidate: event.candidate, sender: peerId }));
            }
        };

        pc.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pcRef.current = pc;
    };

    const handleOffer = async (offer: RTCSessionDescriptionInit, sender: string) => {
        if (!pcRef.current) createPeerConnection(sender);
        try {
            await pcRef.current!.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pcRef.current!.createAnswer();
            await pcRef.current!.setLocalDescription(answer);
            stompClientRef.current.send('/app/answer', {}, JSON.stringify({ answer: answer, sender: sender }));
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    };

    const handleAnswer = async (answer: RTCSessionDescriptionInit, sender: string) => {
        if (!pcRef.current) return;
        try {
            await pcRef.current!.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    };

    const handleCandidate = async (candidate: RTCIceCandidateInit, sender: string) => {
        try {
            await pcRef.current!.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding received ice candidate', error);
        }
    };

    const createOffer = async (peerId: string) => {
        if (!pcRef.current) createPeerConnection(peerId);
        try {
            const offer = await pcRef.current!.createOffer();
            await pcRef.current!.setLocalDescription(offer);
            stompClientRef.current.send('/app/offer', {}, JSON.stringify({ offer: offer, sender: peerId }));
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    };

    return (
        <div>
            <video ref={localVideoRef} autoPlay playsInline muted />
            <video ref={remoteVideoRef} autoPlay playsInline />
            <button onClick={startLocalStream}>Start Local Stream</button>
            <button onClick={() => createOffer('peer1')} disabled={!connected}>Call Peer 1</button>
        </div>
    );
};

export default WebRTCComponent;

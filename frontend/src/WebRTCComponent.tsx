import React, { useEffect, useRef, useState } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

const WebRTCComponent: React.FC = () => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
    const localStreamRef = useRef<MediaStream | null>(null);
    const pcRefs = useRef<{ [key: string]: RTCPeerConnection }>({});
    const stompClientRef = useRef<any>(null);

    const [connected, setConnected] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState<string[]>([]);

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
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                stompClientRef.current.send('/app/candidate', {}, JSON.stringify({ candidate: event.candidate, sender: peerId }));
            }
        };

        pc.ontrack = (event) => {
            if (!remoteStreams.includes(peerId)) {
                setRemoteStreams((prevStreams) => [...prevStreams, peerId]);
            }
            if (remoteVideoRefs.current[peerId]) {
                remoteVideoRefs.current[peerId].srcObject = event.streams[0];
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pcRefs.current[peerId] = pc;
    };

    const handleOffer = async (offer: RTCSessionDescriptionInit, sender: string) => {
        if (!pcRefs.current[sender]) createPeerConnection(sender);
        await pcRefs.current[sender]!.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pcRefs.current[sender]!.createAnswer();
        await pcRefs.current[sender]!.setLocalDescription(answer);
        stompClientRef.current.send('/app/answer', {}, JSON.stringify({ answer: answer, sender: sender }));
    };

    const handleAnswer = async (answer: RTCSessionDescriptionInit, sender: string) => {
        await pcRefs.current[sender]!.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const handleCandidate = async (candidate: RTCIceCandidateInit, sender: string) => {
        try {
            await pcRefs.current[sender]!.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding received ice candidate', error);
        }
    };

    const createOffer = async (peerId: string) => {
        if (!pcRefs.current[peerId]) createPeerConnection(peerId);
        const offer = await pcRefs.current[peerId]!.createOffer();
        await pcRefs.current[peerId]!.setLocalDescription(offer);
        stompClientRef.current.send('/app/offer', {}, JSON.stringify({ offer: offer, sender: peerId }));
    };

    return (
        <div>
            <video ref={localVideoRef} autoPlay playsInline muted />
            {remoteStreams.map((peerId) => (
                <video key={peerId} ref={el => { if (el) remoteVideoRefs.current[peerId] = el }} autoPlay playsInline />
            ))}
            <button onClick={startLocalStream}>Start Local Stream</button>
            <button onClick={() => createOffer('peer1')} disabled={!connected}>Call Peer 1</button>
            <button onClick={() => createOffer('peer2')} disabled={!connected}>Call Peer 2</button>
        </div>
    );
};

export default WebRTCComponent;

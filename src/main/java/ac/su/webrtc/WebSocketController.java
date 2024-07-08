package ac.su.webrtc;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

// Message 클래스를 임포트
import ac.su.webrtc.Message;

@Controller
public class WebSocketController {

    @MessageMapping("/offer")
    @SendTo("/topic/offer")
    public Message sendOffer(Message message) {
        return message;
    }

    @MessageMapping("/answer")
    @SendTo("/topic/answer")
    public Message sendAnswer(Message message) {
        return message;
    }

    @MessageMapping("/candidate")
    @SendTo("/topic/candidate")
    public Message sendCandidate(Message message) {
        return message;
    }
}

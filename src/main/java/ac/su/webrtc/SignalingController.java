package ac.su.webrtc;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

// Message 클래스를 임포트
import ac.su.webrtc.Message;

@Controller
public class SignalingController {

    @MessageMapping("/offer")
    @SendTo("/topic/offer")
    public Message processOffer(Message offer) {
        return offer;
    }

    @MessageMapping("/answer")
    @SendTo("/topic/answer")
    public Message processAnswer(Message answer) {
        return answer;
    }

    @MessageMapping("/candidate")
    @SendTo("/topic/candidate")
    public Message processCandidate(Message candidate) {
        return candidate;
    }
}

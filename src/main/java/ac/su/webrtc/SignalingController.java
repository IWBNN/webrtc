package ac.su.webrtc;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class SignalingController {

    @MessageMapping("/offer")
    @SendTo("/topic/offer")
    public String processOffer(String offer) {
        return offer;
    }

    @MessageMapping("/answer")
    @SendTo("/topic/answer")
    public String processAnswer(String answer) {
        return answer;
    }
}

package pl.dziekanat.zaliczenie_semestru_srv;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

public class PaymentServiceTest {
    @Test
    void chargeTest(){
        PaymentService.Payment payment = new PaymentService.Payment( "987", 999);
        PaymentService paymentService = new PaymentService();
        ResponseEntity<PaymentService.PaymentStatus> paymentStatus = paymentService.charge(payment);
        Assertions.assertEquals(HttpStatus.OK, paymentStatus.getStatusCode());
        Assertions.assertEquals("ABC321", paymentStatus.getBody().getTransId());
    }
}

package pl.dziekanat.zaliczenie_semestru_srv;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payment-service")
public class PaymentService {
    private final static Logger LOG = LoggerFactory.getLogger(PaymentService.class);

    public static class Payment{
        private String accountNo;
        private int amount;

        public String getAccountNo() {
            return accountNo;
        }

        public void setAccountNo(String accountNo) {
            this.accountNo = accountNo;
        }

        public int getAmount() {
            return amount;
        }

        public void setAmount(int amount) {
            this.amount = amount;
        }

        public Payment(String accountNo, int amount) {
            this.accountNo = accountNo;
            this.amount = amount;
        }
    }

    public static class PaymentStatus{
        private String transId;

        public String getTransId() {
            return transId;
        }

        public void setTransId(String transId) {
            this.transId = transId;
        }

        public PaymentStatus(String transId) {
            this.transId = transId;
        }
    }
    @PostMapping
    public ResponseEntity<PaymentStatus> charge(@RequestBody Payment payment) {
        LOG.info("charge account {} for {}", payment.getAccountNo(), payment.getAmount());
        return new ResponseEntity<>(new PaymentStatus("ABC321"), HttpStatus.OK);
    }
}

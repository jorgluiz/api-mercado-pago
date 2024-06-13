const express = require('express');
const path = require('path');
const open = require('open');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const mercadopago = require("mercadopago");
const session = require('express-session');
require('dotenv').config()

const app = express()

const idempotencyKey = uuidv4();


// const { processPayment } = require('./public/mercadopagoAPI/processPayment')

app.use(cors({
  origin: 'https://mercadopago-vendas-44e916035beb.herokuapp.com/' // Substitua 'https://seu-domínio.com' pelo domínio do seu aplicativo
}));

const mercadoPagoPublicKey = process.env.MERCADO_PAGO_SAMPLE_PUBLIC_KEY;
if (!mercadoPagoPublicKey) {
  console.log("Error: public key not defined");
  process.exit(1);
}

const mercadoPagoAccessToken = process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN;
if (!mercadoPagoAccessToken) {
  console.log("Error: access token not defined");
  process.exit(1);
}


const client = new mercadopago.MercadoPagoConfig({
  accessToken: mercadoPagoAccessToken,
});

const payment = new mercadopago.Payment(client);
const customer = new mercadopago.Customer(client);
const paymentMethods = new mercadopago.PaymentMethod(client);

// O código define o motor de visualização como HTML
app.set("view engine", "html");
app.engine("html", require("hbs").__express);
app.set("views", path.join(__dirname, "public/views"));

// Arquivos estáticos, incluindo CSS e JavaScript, a partir da pasta "public".
// Isso permite usar css e js em seus arquivos HTML.
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.use(session({
  secret: 'your-secret-key', // Troque por uma chave secreta real
  resave: false,
  saveUninitialized: true
}));

// Redireciona a rota raiz (/) para /payment-choice
app.get("/", (req, res) => {
  res.redirect("/payment-choice");
});

app.get("/payment-choice", function (req, res) {
  res.status(200).render("./paymentChoice");
});

app.get("/card-payment", function (req, res) {
  res.status(200).render("./cardPayment", { mercadoPagoPublicKey });
});

app.get("/ticket-payment", function (req, res) {
  res.status(200).render("./ticketPayment", { mercadoPagoPublicKey });
});

app.get("/pix-payment", function (req, res) {
  res.status(200).render("./pixPayment/pixPayment", { mercadoPagoPublicKey });
});

app.get("/pix-confirm-payment", function (req, res) {
  const qrCodeBase64 = req.session.qrCodeBase64; // Recupera o QR code da sessão
  res.status(200).render("./pixPayment/confirmPayment", { qrCodeBase64 });
});

app.post('/process_payment/ticket', (req, res) => {

  // Obter a data atual
  const today = new Date();

  // Adicionar 20 dias à data atual
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + 20);
  const offset = -4; // Deslocamento de fuso horário em horas (por exemplo, -4 para -04:00)
  const formattedDate = new Date(futureDate.getTime() - (offset * 60 * 60 * 1000)).toISOString().replace('Z', `${offset > 0 ? '+' : '-'}${String(Math.abs(offset)).padStart(2, '0')}:00`);

  payment.create({
    body: {
      transaction_amount: parseFloat(req.body.transactionAmount),
      description: req.body.description,
      payment_method_id: "bolbradesco",
      date_of_expiration: formattedDate,
      payer: {
        email: req.body.email,
        first_name: req.body.payerFirstName,
        last_name: req.body.payerLastName,
        identification: {
          type: req.body.identificationType,
          number: req.body.identificationNumber
        },
        address: {
          zip_code: "50050540",
          street_name: "Av. visconde de suassuna",
          street_number: "273",
          neighborhood: "Santo Amaro",
          city: "Recife",
          federal_unit: "PE"
        },
        phone: {
          area_code: "81",
          number: "987604690"
        }
      }
    },
    requestOptions: { idempotencyKey: idempotencyKey }
  })
    .then((result) => {
      res.redirect(result.transaction_details.external_resource_url)
    })
    .catch((error) => console.log(error));
})

app.post('/process_payment/pix', (req, res) => {

  payment.create({
    body: {
      transaction_amount: parseFloat(req.body.transactionAmount),
      description: req.body.description,
      payment_method_id: "pix",
      payer: {
        email: req.body.email,
        first_name: req.body.payerFirstName,
        last_name: req.body.payerLastName,
        identification: {
          type: req.body.identificationType,
          number: req.body.identificationNumber
        },
        address: {
          zip_code: "50050540",
          street_name: "Av. visconde de suassuna",
          street_number: "273",
          neighborhood: "Santo Amaro",
          city: "Recife",
          federal_unit: "PE"
        },
        phone: {
          area_code: "81",
          number: "987604690"
        }
      }
    },
    requestOptions: { idempotencyKey: idempotencyKey }
  })
    // .then((result) => console.log(result.point_of_interaction.transaction_data.qr_code_base64))
    // .then((result) => res.redirect(`/pix-confirm-payment?qr_code_base64=${result.point_of_interaction.transaction_data.qr_code_base64}`))
    .then((result) => {
      const qrCodeBase64 = result.point_of_interaction.transaction_data.qr_code_base64
      req.session.qrCodeBase64 = qrCodeBase64; // Armazena o QR code na sessão
      res.redirect(`/pix-confirm-payment`)
    })
    // .then((result) => res.redirect(result.point_of_interaction.transaction_data.ticket_url))
    .catch((error) => console.log(error));
})


app.post('/process_payment/card', async (req, res) => {
  try {
    const body = req.body;

    const paymentData = {
      transaction_amount: body.transaction_amount,
      token: body.token,
      description: body.description,
      installments: body.installments,
      payment_method_id: body.paymentMethodId,
      issuer_id: body.issuerId,
      campaign_id: null,
      capture: false,
      coupon_amount: null,
      differential_pricing_id: null,
      metadata: null,
      payer: {
        first_name: "Evlyn",
        last_name: "Monteiro",
        email: body.payer.email,
        identification: {
          type: body.payer.identification.type,
          number: body.payer.identification.number,
        },
        phone: {
          area_code: 81,
          number: "988026794"
        },
        address: {
          street_number: null
        }
      },
    };

    app.post('/process_payment/boleto', (req, res) => {

    })

    const response = await axios.post('https://api.mercadopago.com/v1/payments', paymentData, {
      headers: {
        'Authorization': `Bearer ${process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN}`, // Substitua SEU_ACCESS_TOKEN pelo seu token de acesso do Mercado Pago
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      }
    });

    console.log(response.data);
    res.status(201).json({
      detail: response.data.status_detail,
      status: response.data.status,
      id: response.data.id,
    });
  } catch (error) {
    console.error(error);
    const errorMessage = error.response.data.message || 'Erro desconhecido ao processar o pagamento';
    const errorStatus = error.response.status || 500;
    res.status(errorStatus).json({ error_message: errorMessage });
  }
})

app.get('/paymentMethods', function (req, res) {
  paymentMethods.get()
    .then(response => res.json({ methods: response}))
    .catch(error => console.log(error))
})

function validateError(error) {
  let errorMessage = "Unknown error cause";
  let errorStatus = 400;

  if (error.cause) {
    const sdkErrorMessage = error.cause[0].description;
    errorMessage = sdkErrorMessage || errorMessage;

    const sdkErrorStatus = error.status;
    errorStatus = sdkErrorStatus || errorStatus;
  }

  return { errorMessage, errorStatus };
}

app.post('/create_customer', (req, res) => {

  const body = {
    email: 'zetch@hotmail.com',
    first_name: 'jorge',
    last_name: 'luiz',
    phone: {
      area_code: '55',
      number: '81987604690'
    },
    identification: {
      type: 'CPF',
      number: '08432220426'
    },
    default_address: 'Home',
    address: {
      id: '123123',
      zip_code: '53370370',
      street_name: 'Rua Exemplo',
      street_number: 123,
      city: {}
    },
    date_registered: '2021-10-20T11:37:30.000-04:00',
    description: 'Description del user',
    default_card: 'None'
  };

  customer.create({ body: body })
    .then(respnse => {
      console.log(respnse)
      res.json(respnse.data)
    })
    .catch(error => {
      console.log(error)
      res.json(error)
    })
})

app.get('/get_customer', async (req, res) => {
  const customer = await axios.get('https://api.mercadopago.com/v1/customers/search', {
    headers: {
      'Authorization': `Bearer ${process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN}`, // Substitua SEU_ACCESS_TOKEN pelo seu token de acesso do Mercado Pago
      'Content-Type': 'application/json'
    }
  })
  console.log(customer)
  res.json(customer.data)
})

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`The server is now running on port ${PORT}`);
  open(`http://localhost:${PORT}`);
})

// app.get('/venda', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'views', 'index.html'));
// });

// app.post('/process_payment', (req, res) => {
//   const body = req.body;
//   console.log(body)

//   const paymentData = {
//     transaction_amount: body.transaction_amount,
//     token: body.token,
//     description: body.description,
//     installments: body.installments,
//     payment_method_id: body.paymentMethodId,
//     issuer_id: body.issuerId,
//     campaign_id: null,
//     capture: false,
//     coupon_amount: null,
//     differential_pricing_id: null,
//     metadata: null,
//     payer: {
//       first_name: "Evlyn",
//       last_name: "Monteiro",
//       email: body.payer.email,
//       identification: {
//         type: body.payer.identification.type,
//         number: body.payer.identification.number,
//       },
//       phone: {
//         area_code: 81,
//         number: "988026794"
//       },
//       address: {
//         street_number: null
//       }
//     },
//   };

//   payment.create({ body: paymentData, requestOptions: { idempotencyKey: '0d5020ed-1af6-469c-ae06-c3bec19954bb' } })
//     .then(function (data) {
//       console.log(data)
//       res.status(201).json({
//         detail: data.status_detail,
//         status: data.status,
//         id: data.id,
//       });
//     })
//     .catch(function (error) {
//       console.log(error);
//       const { errorMessage, errorStatus } = validateError(error);
//       res.status(errorStatus).json({ error_message: errorMessage });
//     });

// })
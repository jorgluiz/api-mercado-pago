payment.create({
    body: {
      transaction_amount: 100,
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
          city: "recife",
          federal_unit: "pe"
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
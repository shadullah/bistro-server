const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const body_parser = require("body-parser");
const port = process.env.PORT || 5000;
const {
  createPayment,
  executePayment,
  queryPayment,
  searchTransaction,
  refundTransaction,
} = require("bkash-payment");

// middlewares
app.use(cors());
app.use(express.json());
app.use(body_parser.json());
app.use(body_parser.urlencoded({ extended: true }));

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.agaitrv.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

// users related api
const userCollection = client.db("bistrodb").collection("users");
const payCollection = client.db("bistrodb").collection("payment");

app.get("/users", async (req, res) => {
  const result = await userCollection.find().toArray();
  res.send(result);
});

app.get("/users/admin/:email", async (req, res) => {
  const email = req.params.email;
  if (email !== req.email) {
    return res.status(403).send({ message: "unauthorized access" });
  }
  const query = { email: email };
  const user = await userCollection.findOne(query);
  let admin = false;
  if (user) {
    admin = user?.email === "hexaalif2020@gmail.com";
  }
  res.send({ admin });
});

app.post("/users", async (req, res) => {
  const user = req.body;
  const query = { email: user.email, name: user.name, mobile: user.mobile };
  const existingUser = await userCollection.findOne(query);
  if (existingUser) {
    return res.send({ message: "user already exists", insertedId: null });
  }
  const result = await userCollection.insertOne(user);
  res.send(result);
  console.log(result);
});

// bKASH HERE
const bkashConfig = {
  base_url: "https://tokenized.sandbox.bka.sh/v1.2.0-beta",
  username: "sandboxTokenizedUser02",
  password: "sandboxTokenizedUser02@12345",
  app_key: "4f6o0cjiki2rfm34kfdadl1eqq",
  app_secret: "2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b",
};
// const bkashConfig = {
//   base_url: "https://tokenized.sandbox.bka.sh/v1.2.0-beta/",
//   username: "testdemo",
//   password: "test%#de23@msdao",
//   app_key: "5nej5keguopj928ekcj3dne8p",
//   app_secret: "1honf6u1c56mqcivtc9ffl960slp4v2756jle5925nbooa46ch62",
// };

app.post("/bkash-checkout", async (req, res) => {
  try {
    const { amount, callbackURL, orderID, reference } = req.body;
    const paymentDetails = {
      amount: amount, // your product price
      callbackURL: callbackURL, // your callback route
      orderID: orderID || "Order_101", // your orderID
      reference: reference || "1", // your reference
    };
    const result = await createPayment(bkashConfig, paymentDetails);
    //   ssend bkash callback url to the client
    res.status(200).send(result?.bkashURL);
  } catch (e) {
    console.log(e);
  }
});

app.get("/bkash-callback", async (req, res) => {
  try {
    const { status, paymentID } = req.query;
    let result;
    let response = {
      statusCode: "4000",
      statusMessage: "Payment Failed",
    };
    if (status === "success")
      result = await executePayment(bkashConfig, paymentID);

    if (result?.transactionStatus === "Completed") {
      // payment success
      // insert result in your db
      console.log(result);
    }
    if (result)
      response = {
        statusCode: result?.statusCode,
        statusMessage: result?.statusMessage,
      };
    // You may use here WebSocket, server-sent events, or other methods to notify your client
    res.redirect("http://localhost:5173/");
  } catch (e) {
    console.log(e);
  }
});

// Add this route under admin middleware
app.post("/bkash-refund", async (req, res) => {
  try {
    const { paymentID, trxID, amount } = req.body;
    const refundDetails = {
      paymentID,
      trxID,
      amount,
    };
    const result = await refundTransaction(bkashConfig, refundDetails);
    res.send(result);
  } catch (e) {
    console.log(e);
  }
});

app.get("/bkash-search", async (req, res) => {
  try {
    const { trxID } = req.query;
    const result = await searchTransaction(bkashConfig, trxID);
    res.send(result);
  } catch (e) {
    console.log(e);
  }
});

app.get("/bkash-query", async (req, res) => {
  try {
    const { paymentID } = req.query;
    const result = await queryPayment(bkashConfig, paymentID);
    res.send(result);
  } catch (e) {
    console.log(e);
  }
});

app.get("/", (req, res) => {
  res.send("boss is sitting");
});

app.listen(port, () => {
  console.log(`Bistro boss is sitting at ${port}`);
});

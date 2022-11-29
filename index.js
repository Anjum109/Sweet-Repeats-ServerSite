const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

// middle were 
app.use(cors())
app.use(express.json())

//mongo


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jjbnacp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    console.log('token inside verifyJWT', req.headers.authorization);
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access')
    }

    const token = authHeader.split('')[1];
    jwt.verify(token, process.env.JWT_ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}


async function run() {
    try {
        const categoryCollections = client.db('sweetRepeats').collection('categories');
        const usersCollection = client.db('sweetRepeats').collection('users');
        const productCollections = client.db('sweetRepeats').collection('products');
        const bookingCollections = client.db('sweetRepeats').collection('bookings')
        const paymentsCollection = client.db('sweetRepeats').collection('payments');

        app.get('/categories', async (req, res) => {
            const query = {};
            const options = await categoryCollections.find(query).toArray();
            res.send(options);
        })
        app.get('/category', async (req, res) => {
            const query = {};
            const options = await productCollections.find(query).toArray();
            res.send(options);
        })


        app.get('/categories/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const category_name = await categoryCollections.findOne(filter);
            const query = { category_name: category_name.category_name };
            const result = await productCollections.find(query).toArray();
            res.send(result);
        })

        //for all users//

        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        })

        // admin 
        app.put('/users/admin/:id', verifyJWT, async (req, res) => {

            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });
        // admin role 
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' })
        })

        //for all users//

        //for all buyers
        app.get('/allbuyers', async (req, res) => {
            const query = { role: "Buyer" };
            const buyers = await usersCollection.find(query).toArray();
            res.send(buyers);
        })
        //for all buyers

        //  for all sellers
        app.get('/allsellers', async (req, res) => {
            const query = { role: "Seller" };
            const sellers = await usersCollection.find(query).toArray();
            res.send(sellers);
        })

        app.get('/allsellers/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.findOne(query);
            res.send(result);

        });

        app.delete('/allsellers/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })
        //  for all sellers


        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        //for bookings
        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const booking = await bookingCollections.find(query).toArray();
            res.send(booking);
        });
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingCollections.insertOne(booking);
            res.send(result)
        });
        //orders
        app.get('/categories/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const service = await categoryCollections.findOne(query)
            res.send(service)
        });
        //payment
        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const booking = await bookingCollections.findOne(query);
            res.send(booking)
        })

        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await bookingCollections.updateOne(filter, updatedDoc)
            res.send(result);
        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            console.log(user);
            if (user) {
                const token = jwt.sign({ email }, process.env.JWT_ACCESS_TOKEN, { expiresIn: '10hr' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: 'token' })
        });



    }
    finally {

    }
}
run().catch(console.log);

app.get('/', async (req, res) => {
    res.send('sweet repeats server is running');
})

app.listen(port, () => console.log(`sweet repeat  running ${port}`))
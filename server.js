require('dotenv').config()
const colivings = require('./colivings.json');

const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const config = require('config');
const express = require('express');
const moment = require('moment');
const randtoken = require('rand-token');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;
const { setup } = require('axios-cache-adapter');
const sgMail = require('@sendgrid/mail');
const Joi = require('@hapi/joi');
const jsonwebtoken = require('jsonwebtoken');


const port = process.env.PORT || 3300
const api = setup({
    baseURL: ` http://localhost:${port}`,
    cache: {
        maxAge: 15 * 60 * 1000
    }
});
const db = require('./db');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//domainCors = config.get('domainCors');
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", '*');
    res.header ("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});

// Winston config
const myFormat = printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
});
const logger = createLogger({
    level: 'debug',
    format: combine(
        label({ label: 'main' }), timestamp(),
        myFormat
    ),
    defaultMeta: { service: 'user-service' },
    transports: [
        new transports.File({ filename: 'debug.log', level: 'debug' })
    ]
});

app.use((req, res, next) => {
    logger.debug(`Request to ${req.url} with method ${req.method} and body data ${JSON.stringify(req.body)}`);

    next();
});



// Portada
app.get('/', (req, res) => {
    res.send('llega peticion: ')
});


app.post('/signup', async (req, res, next) => {
    const name = req.body.name;
    const surname = req.body.surname;
    const email = req.body.email;
    const password = req.body.password;
    const profession = req.body.profession;
    const country = req.body.country;

    const schema = Joi.object({
        name: Joi.string()
            .required(),
        surname: Joi.string()
            .required(),
        password: Joi.string()
            .required(),
        email: Joi.string()
            .email()
            .required(),
        profession: Joi.string()
            .required(),
        country: Joi.string()
            .required()
    })

    try {
        validation = await schema.validateAsync(req.body);

        const BCRYPT_SALT_ROUNDS = 12


        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        const id = await db.saveUser(name, surname, email, hashedPassword, profession, country);

        const token = jsonwebtoken.sign({
            id: id,
            role: 'coliver'
        }, config.token_password, {
            expiresIn: 86400
        });

        res.send({ token, id, name, surname, email, profession, country });
    } catch (e) {
        console.log(e.message);
        res.status(400).send(e);
    }
});

app.post('/login', async (req, res, next) => {

    try {
        const email = req.body.email;
        const password = req.body.password;
        const user = await db.getUserByEmail(email);
        const id = user.id;
        const name = user.name;
        let surname = user.surname;
        let profession = user.profession;
        let country = user.country;

        const samePassword = await bcrypt.compare(password, user.password);

        if (!samePassword) {
            return res.status(403).send('Usuario o password incorrectos');
        }
        

        const token = jsonwebtoken.sign({
            id: id,
            role: 'coliver'
        }, config.token_password, {
            expiresIn: 86400
        });
        res.json({ token, id, name, surname, email, profession, country });
    } catch (e) {
        console.log(e.message);
        res.status(403).send({});
    }
});

//pedir todos los colivings 
app.get('/colivings', async (request, response) => {
    let colivings = await db.getColivings();
    response.status(200).json(colivings);
});

app.post('/search/colivings', async (request, response) => {
    const city = request.body['city'];
    //const entryWeek = request.body.searchEntryWeek;
    //const departureWeek = request.body.searchDepartureWeek;
    //const weeklyPrice = request.body.searchPrize;
    //const monthlyPrice = request.body.monthPrize;
    //const profession = request.body.searchProfession;
    const colivings = await db.searchColivings(city);
    response.status(200).json(colivings);
});


// obtener info de un coliving
app.get('/coliving/:id', async (request, response) => {
    const idColiving = request.params.id;
    const colivingInfo = await db.getColivingInfo(idColiving);
    response.status(200).json(colivingInfo);
});

//obtener info de los apartamentos de un coliving
app.get('/apartments/:id_coliving/', async (request, response) => {
    const idColiving = request.params.id_coliving;
    const apartments = await db.getApartmentsByColivingId(idColiving);
    response.status(200).json(apartments);
});

// obtener el perfil de un coliver
app.get('/user/profile', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");
        if (tokenInfo.role !== 'coliver') {
            return response.status(403).send("Rol no válido");
        }

        const idColiver = tokenInfo.id;
        const coliver = await db.getColiverById(idColiver);
        response.status(200).json(coliver);
    });
});

//Editar perfil área privada colivers 
app.put('/user/profile/edit', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");

        if (tokenInfo.role !== 'coliver') {
            return response.status(403).send("Rol no válido");
        }

        const name = request.body.name;
        const surname = request.body.surname;
        const email = request.body.email;
        const profession = request.body.profession;
        const country = request.body.country;
        const id = tokenInfo.id;


        await db.editColiver(id, name, surname, email, profession, country);
        response.status(200).json();
    });

});

//Rating reservation 
app.post('/user/reservation/rate', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");

        if (tokenInfo.role !== 'coliver') {
            return response.status(403).send("Rol no válido");
        }

        const idReservation = request.body.idReservation;
        const score = request.body.score;
        const id = tokenInfo.id;
        await db.rateReservation(idReservation, score, id);
        return response.status(200).json();
    });
});

//Rating colivers 
app.post('/user/coliver/rate', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");

        if (tokenInfo.role !== 'coliver') {
            return response.status(403).send("Rol no válido");
        }

        const scored = request.body.scored;
        const score = request.body.score;
        const scorer = tokenInfo.id;
        await db.rateColiver(scored, scorer, score);
        response.status(200).json();
    });
});

// Hacer una reserva
app.post('/user/reservation/add', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");

        if (tokenInfo.role !== 'coliver') {
            return response.status(403).send("Rol no válido");
        }

        const bookingNumber = randtoken.generate(6, "1234567890");
        const entryDate = request.body.EntryWeek;
        const departureDate = request.body.DepartureWeek;
        let duration = (new Date(departureDate) - new Date(entryDate)) / (1000 * 60 * 60 * 24 * 7);
        const idColiver = tokenInfo.id;
        const idApartment = request.body.apartment.id;
        const price = Math.round(duration * await db.getColivingWeeklyPriceByAparmentId(idApartment) * 100) / 100;
        await db.addReservation(bookingNumber, price, entryDate, departureDate, idColiver, idApartment);
        return response.status(200).json();
    });
});

//usuario consulta sus servicios.
app.get('/user/services', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");

        if (tokenInfo.role !== 'coliver') {
            return response.status(403).send("Rol no válido");
        }

        const id = tokenInfo.id;
        const services = await db.getServicesByColiverId(id);
        response.status(200).json(services)
    });
});

// obtener el perfil de un host
app.get('/host/profile', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");

        if (tokenInfo.role !== 'host') {
            return response.status(403).send("Rol no válido");
        }

        const id = tokenInfo.id;
        const host = await db.getHostById(id);
        response.status(200).json(host);
    });
});

//Editar perfil área privada Host - Gestores-
app.put('/host/dashboard/profile/edit', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");

        if (tokenInfo.role !== 'host') {
            return response.status(403).send("Rol no válido");
        }

        const contactName = request.body.contact_name;
        const contactSurname = request.body.contact_surname;
        const contactEmail = request.body.contact_email;
        const name = request.body.name;
        const street = request.body.street;
        const zipCode = request.body.zip_code;
        const country = request.body.country;
        const city = request.body.city;
        const apartamentsCount = request.body.apartments_count;
        const roomType = request.body.rooms_type;
        const roomCount = request.body.rooms_count;
        /*const coliving.services =*/
        const weeklyPrice = request.body.weekly_price;
        const monthlyPrice = request.body.monthly_price;
        const website = request.body.website;
        const facebook = request.body.facebook;
        const instagram = request.body.instagram;
        const twitter = request.body.twitter;
        const poster = request.body.poster;
        const description = request.body.description;
        const id = tokenInfo.id;
        await db.editHost(id, contactName, contactSurname, contactEmail, name, street, zipCode, city,country,
            apartamentsCount, roomCount, roomType, weeklyPrice, monthlyPrice, website, facebook, instagram, twitter,
            poster, description);
        response.status(200).json();
    });
});

// Host publica un Apartment
app.post('/host/add/apartment', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");

        if (tokenInfo.role !== 'host') {
            return response.status(403).send("Rol no válido");
        }

        const roomsCount = request.body.rooms_count;
        const photoRoom1 = request.body.photo_room1;
        const id = tokenInfo.id;

        await db.addApartment(id, roomsCount, photoRoom1);
        response.status(200).json();
    });
});

//Host elimina un Apartment
app.delete('/host/apartment/delete', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");

        if (tokenInfo.role !== 'host') {
            return response.status(403).send("Rol no válido");
        }

        const id = request.body.id;
        const idHost = tokenInfo.id;
        await db.deleteApartment(id, idHost);
        response.status(200).json();
    });
});

//Host modifica un Apartment
app.put('/host/apartment/edit', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");

        if (tokenInfo.role !== 'host') {
            return response.status(403).send("Rol no válido");
        }

        const roomsCount = request.body.rooms_count;
        const photoRoom1 = request.body.photo_room1;
        const id = request.body.id;
        const idHost = tokenInfo.id;

        await db.editApartment(id, roomsCount, photoRoom1, idHost);
        response.status(200).json();
    });
});
//Host consulta sus servicios.
app.get('/host/coliving/services', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");

        if (tokenInfo.role !== 'host') {
            return response.status(403).send("Rol no válido");
        }

        const id = tokenInfo.id;
        const services = await db.getServiceByColivingId(id);
        response.status(200).json(services)
    });
});

//Host consulta sus reservas.
app.get('/host/coliving/reservations/', async (request, response) => {
    //app.get('/host/coliving/reservations/:id_apartment', async (request, response) => {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);

    //const id_apartment = req.params.id_apartment;
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    jsonwebtoken.verify(requestToken, config.token_password, async function (error, tokenInfo) {
        if (error)
            return response.status(401).send("Authentication failed");

        if (tokenInfo.role !== 'host') {
            return response.status(403).send("Rol no válido");
        }

        const id = tokenInfo.id;
        const Reservation = await db.getReservationsByApartmentId(id);
        response.status(200).json(Reservation)
    });
});

//enviar mensage en Contact Form
app.post('/contact', function (req, res, next) {
    const BEARER_END = 7;
    const authorizationHeader = request.headers.authorization;
    const requestToken = authorizationHeader.slice(BEARER_END);
    if (!requestToken) {
        return response.status(401).send("No hay token");
    }

    const name = req.body.name;
    const email = req.body.email;
    const message = req.body.message;

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
        to: 'colivingxt@gmail.com',
        from: email,
        subject: name,
        html: message,
    };
    sgMail.send(msg);

    res.send('OK');
});

app.post('/host/signup', async (req, res, next) => {
    const contactName = req.body.name;
    const surname = req.body.surname;
    const email = req.body.email;
    const password = req.body.password;
    const colivingName = req.body.colivingName;
    const street = req.body.street;
    const zipcode = req.body.zipcode;
    const city = req.body.city;
    const country = req.body.country;
    const apartments = req.body.apartments;
    const rooms = req.body.rooms;
    const roomType = req.body.roomType;
    const facilities = req.body.facilities;
    const website = req.body.website;
    const facebook = req.body.facebook;
    const instagram = req.body.instagram;
    const twitter = req.body.twitter;

    const schema = Joi.object({
        name: Joi.string()
            .required(),
        surname: Joi.string()
            .required(),
        password: Joi.string()
            .required(),
        email: Joi.string()
            .email()
            .required(),
        colivingName: Joi.string()
            .required(),
        apartments: Joi.number()
            .required(),
        rooms: Joi.number()
            .required(),
        roomType: Joi.string()
            .required(),
        website: Joi.string(),
        facebook: Joi.string(),
        twitter: Joi.string(),
        instagram: Joi.string(),
        street: Joi.string(),
        zipcode: Joi.string(),
        country: Joi.string(),
        city: Joi.string(),
        photo: Joi.string().allow(),
        facilities: Joi.string().allow(''),
    })

    try {      
        
        
        const validation = await schema.validateAsync(req.body);

        const BCRYPT_SALT_ROUNDS = 12

        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        console.log('antes de savehoster');
        const user = await db.saveHostUser(contactName, surname, email, hashedPassword, colivingName, apartments, rooms, roomType, street, zipcode, city, country, facilities, website, facebook, instagram, twitter);

        const { id, name, zip_code, apartments_count,
            rooms_count, room_type, weekly_price, monthly_price, poster, score, contact_name,
            contact_surname, description, contact_email } = user;

        const token = jsonwebtoken.sign({
            id: id,
            role: 'host'
        }, config.token_password, {
            expiresIn: 86400
        });
        res.send({
            token, id, name, street, zip_code, city, country, apartments_count,
            rooms_count, room_type, weekly_price, monthly_price, poster, score, contact_name,
            contact_surname, website, facebook, instagram, twitter, description, contact_email
        });
    } catch (e) {
        console.log(e.message);
        res.status(400).send(e);
    }
});
app.post('/host/login', async (req, res, next) => {
    try {
        const email = req.body.email;
        const password = req.body.password;


        const user = await db.getHostUserByEmail(email);

        const samePassword = await bcrypt.compare(password, user.contact_password);

        if (!samePassword) {
            return res.status(403).send('Usuario o password incorrectos');
        }


        const { id, name, street, zip_code, city, country, apartments_count,
            rooms_count, room_type, weekly_price, monthly_price, poster, score, contact_name,
            contact_surname, website, facebook, instagram, twitter, description, contact_email } = user;

        const token = jsonwebtoken.sign({
            id: id,
            role: 'host'
        }, config.token_password, {
            expiresIn: 86400
        });
        res.json({
            token, id, name, street, zip_code, city, country, apartments_count,
            rooms_count, room_type, weekly_price, monthly_price, poster, score, contact_name,
            contact_surname, website, facebook, instagram, twitter, description, contact_email
        });
    } catch (e) {
        console.log(e.message);
        res.status(403).send({});
    }
});


app.listen(port, () => {
    console.log(`API disponible en: http://localhost:${port}`)
});

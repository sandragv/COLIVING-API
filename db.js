const { Pool } = require('pg');
const moment = require('moment');
const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    max: 20,
    port: 5432,
    password: 'trini',
    database: 'colivingsxt'
});



const saveUser = async (name, surname, email, password, country, profession) => {
    const client = await pool.connect();
    let query = `select * from colivers where email='${email}' `;
    let result = await pool.query(query);

    if (result.rows.length !== 0) {

        throw Error('Usuario existente');
    }
    query = `insert into colivers (name, surname, email, password, country, profession) values ('${name}','${surname}','${email}','${password}','${country}','${profession}')`

    result = await pool.query(query);

    if (result.rowCount !== 1) {

        throw Error('Usuario no guardado');
    }

    query = `select id from colivers where email='${email}'`;

    result = await pool.query(query);

    const id = result.rows[0].id;
    console.log(id);
    return id;
};
const saveHostUser = async (name, surname, email, password, colivingName, apartments, rooms, roomType, street, zipcode, city, country, facilities,
    website, facebook, instagram, twitter) => {
    const client = await pool.connect();
    let query = `select * from colivings where contact_email='${email}' and name = '${colivingName}' `;
    let result = await pool.query(query);

    if (result.rows.length !== 0) {

        throw Error('Usuario existente');
    }
    query = `insert into colivings (contact_name, contact_surname, contact_email, contact_password, name, apartments_count, rooms_count, room_type, website, facebook,
         instagram, twitter, zip_code, street, city, country) values ('${name}','${surname}','${email}','${password}','${colivingName}','${apartments}','${rooms}',
         '${roomType}','${website}','${facebook}','${instagram}','${twitter}','${zipcode}','${street}','${city}','${country}')
         returning *`

    result = await pool.query(query);

    if (result.rowCount !== 1) {

        throw Error('Usuario no guardado');
    }



    client.release();

    const user = result.rows[0];
    return user;
};

const getUserByEmail = async (email) => {
    const client = await pool.connect();
    let query = `select * from colivers where email='${email}' `;

    //Faltan todos os datos para k o facer login se lle pasen ó perfil
    const result = await pool.query(query);

    client.release();

    if (result.rows.length === 0) {
        throw Error('Usuario incorrecto');
    }
    return result.rows[0];
};

const getHostUserByEmail = async (email) => {
    const client = await pool.connect();
    let query = `select * from colivings where contact_email='${email}' `;
    const result = await pool.query(query);

    client.release();

    if (result.rows.length === 0) {
        throw Error('Usuario incorrecto');
    }
    return result.rows[0];
};

// Devuelve todos los colivings
const getColivings = async () => {
    const query = 'select * from colivings';
    const result = await pool.query(query);
    return result.rows;
};

const getColivingInfo = async (id) => {
    const query = 'select * from colivings where id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
};

const getApartmentsByColivingId = async (idColiving) => {
    const query = 'select * from apartments where id_coliving = $1';
    const result = await pool.query(query, [idColiving]);
    return result.rows;
};
// Busca colivings según los criterios
const searchColivings = async (city) => {
    const lowerCity = city.toLowerCase();
    const query = 'select * from colivings where lower(city) = $1';
    const result = await pool.query(query, [lowerCity]);
    return result.rows;
};

const getColiversByProfession = async (profession) => {
    const query = 'select * from colivers where profession = $1';
    const result = await pool.query(query, [profession]);
    return result.rows;
};

// Info de un coliver
const getColiverById = async (id) => {
    const query = 'select * from colivers where id = $1';
    const results = await pool.query(query, [id]);
    return results.rows;
};

const editColiver = async (id, name, surname, email, profession, country) => {
    const query = 'update colivers set name = $2, surname = $3, email = $4, profession = $5, country = $6 ' +
        'where id = $1';

    const result = await pool.query(query, [id, name, surname, email, profession, country]);
    return result.rows;
};

const getColiverService = async (id) => {
    const query = 'select * from coliver_service where id = $1';
    const result = await pool.query(query, [id]);
    return result.rows;
};

const rateColiver = async (id_coliver_scorer, id_coliver_scored, rating) => {
    const query = 'insert into colivers_scoring (id_coliver_scorer, id_coliver_scored, score) values ($1, $2, $3)';
    await pool.query(query, [id_coliver_scorer, id_coliver_scored, rating]);
};

const rateReservation = async (idReservation, rating, idColiver) => {
    const queryReservation = 'update reservations set score = $1 where id = $2 and id_coliver = $3';
    await pool.query(queryReservation, [rating, idReservation, idColiver]);
};

const getReservationsByColiverId = async (id) => {
    const query = 'select * from reservations where id_coliver = $1';
    const result = await pool.query(query, [id]);
    return result.rows;
};

const getServicesByColiverId = async (id) => {
    const query = 'select services.name from services, coliver_service where coliver_service.id_service = services.id and id_coliver = $1';
    const result = await pool.query(query, [id]);
    return result.rows;
};

const getColivingIdByReservationId = async (id) => {
    const query = "select apartments.id_coliving from reservations, apartments " +
        "where reservations.id_apartment = apartments.id and reservartions.id = $1";
    const result = await pool.query(query, [id]);
    return result.rows[0].id_coliving;
};

// Info de un host
const getHostById = async (id) => {
    const query = 'select * from colivings where id = $1';
    const results = await pool.query(query, [id]);
    return results.rows;
};

//Editar en área privada de un Host - Gestores -
const editHost = async (id, contactName, contact_surname, contact_email, name, street, zip_code, city, country, apartments_count,
                        rooms_count, room_type, weekly_price, monthly_price, website, facebook, instagram, twitter, poster, description) => {
    const query = 'update colivings set contact_name = $1, contact_surname = $2, contact_email = $3, name = $4, street = $5,' +
    ' zip_code = $6, city = $7, country= $8, apartments_count = $9, rooms_count = $10, room_type = $11, weekly_price= $12,' +
    'monthly_price = $13, website = $14, facebook = $15, instagram = $16, twitter = $17, poster = $18, description = $19 where id = $20';
    await pool.query(query, [contactName, contact_surname, contact_email, name, street, zip_code, city, country,
        apartments_count, rooms_count, room_type, weekly_price, monthly_price, website, facebook, instagram, twitter, poster, description, id]);
};

//Host publica un apartment
const addApartment = async (idColiving, rooms_count, photo_room1) => {
    const query = 'insert into apartments (id_coliving, rooms_count, photo_room1) values ($1, $2, $3)';
    await pool.query(query, [idColiving, rooms_count, photo_room1]);
};

//Host elimina un apartment
const deleteApartment = async (id, idHost) => {
    const query = 'delete from apartments where id = $1 and id_coliving = $2';
    await pool.query(query, [id, idHost]);
};

//Host modifica un Apartment
const editApartment = async (id, rooms_count, photo_room1, idHost) => {
    const query = 'update apartments set rooms_count = $1, photo_room1 = $2 where id = $3 and id_coliving = $4';
    await pool.query(query, [rooms_count, photo_room1, id, idHost]);
};

// Añadir una reserva
const addReservation = async (bookingNumber, price, entryDate, departureDate, idColiver, idApartment) => {
    const query = 'insert into reservations (booking_number, price, entry_date, departure_date, id_coliver, id_apartment) ' +
    ' values ($1, $2, $3, $4, $5, $6)';
    await pool.query(query, [bookingNumber, price, entryDate, departureDate, idColiver, idApartment]);
};
    
const getColivingWeeklyPriceByAparmentId = async (idApartment) => {
    let query = 'select id_coliving from apartments where id = $1';
    let result = await pool.query(query, [idApartment]);
    const idColiving = result.rows[0].id_coliving;
    query = 'select weekly_price from colivings where id = $1';
    result = await pool.query(query, [idColiving]);
    return result.rows[0].weekly_price;
};

const getServiceByColivingId = async (id) => {
    const query = 'select services.* from services, service_coliving where ' +
        'services.id = service_coliving.id_service and service_coliving.id_coliving = $1';
    const result = await pool.query(query, [id]);
    return result.rows;
};

const getReservationsByApartmentId = async (id) => {
    const query = 'select * from reservations where id_apartment = $1;'
    const result = await pool.query(query, [id]);
    return result.rows;
};


module.exports = {
    saveUser,
    getUserByEmail,
    getColivings,
    getColivingInfo,
    getApartmentsByColivingId,
    searchColivings,
    getColiversByProfession,
    saveHostUser,
    getHostUserByEmail,
    getColiverById,
    editColiver,
    getColiverService,
    rateColiver,
    rateReservation,
    getReservationsByColiverId,
    getServicesByColiverId,
    getHostById,
    editHost,
    addApartment,
    deleteApartment,
    editApartment,
    addReservation,
    getColivingWeeklyPriceByAparmentId,
    getServiceByColivingId,
    getReservationsByApartmentId
};
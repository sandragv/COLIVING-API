create table if not exists colivers (
	id serial primary key,
	name text,
	surname text,
	email text unique,
	password text,
	country text,
	profession text
);
create table if not exists colivings (
	id serial primary key,
	name text,
	street text,
	zip_code text,
	city text,
	country text,
	apartments_count int,
	rooms_count int,
	room_type text,
	weekly_price float,
	monthly_price float,
	poster text,          
    	score int, 
	contact_name text,
	contact_surname text,
	contact_email text,
	contact_password text,		
	website text,
	facebook text,
	instagram text,
	twitter text,
	description text
);
create table if not exists apartments (
	id serial primary key,
	id_coliving int references colivings,
	rooms_count int,
	photo_room1 text,
	photo_room2 text,
	photo_room3 text,
	photo_room4 text
);
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name text,
    price float
);
create table if not exists reservations (
	id serial primary key,
	booking_number int,
	price float,
	entry_date timestamp,
	departure_date timestamp,
	score int,
	id_coliver int references colivers (id),
	id_apartment int references apartments (id)
);
create table if not exists coliver_service (
	id_coliver int references colivers (id),
	id_service int references services (id),
	price float,
	primary key (id_coliver, id_service)
);

create table if not exists colivers_scoring (
	id_coliver_scorer int references colivers (id),
	id_coliver_scored int references colivers (id),
	score int,
	primary key (id_coliver_scorer, id_coliver_scored)
);

create table if not exists service_coliving (
	id_service int references services (id),
	id_coliving int references colivings (id),
	primary key (id_service, id_coliving)
);


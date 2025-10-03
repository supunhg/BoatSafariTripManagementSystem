USE mysql;
DROP DATABASE IF EXISTS boat_safari_db;

CREATE DATABASE IF NOT EXISTS boat_safari_db;
USE boat_safari_db;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    role ENUM('customer', 'admin', 'operations', 'guide') NOT NULL DEFAULT 'customer',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE boats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL,
    description TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE trips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration_hours INT NOT NULL,
    max_capacity INT NOT NULL,
    departure_location VARCHAR(200) NOT NULL,
    return_location VARCHAR(200) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE trip_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trip_id INT NOT NULL,
    scheduled_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    return_time TIME NOT NULL,
    available_seats INT NOT NULL,
    boat_id INT,
    guide_id INT,
    status ENUM('scheduled', 'confirmed', 'completed', 'cancelled') DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (boat_id) REFERENCES boats(id),
    FOREIGN KEY (guide_id) REFERENCES users(id)
);

CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    trip_schedule_id INT NOT NULL,
    number_of_passengers INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    booking_status ENUM('pending', 'confirmed', 'cancelled', 'completed') DEFAULT 'pending',
    payment_status ENUM('pending', 'paid', 'refunded') DEFAULT 'pending',
    payment_method ENUM('online', 'cash') DEFAULT 'online',
    special_requirements TEXT,
    booking_reference VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (trip_schedule_id) REFERENCES trip_schedules(id)
);

CREATE TABLE passengers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    age INT,
    emergency_contact VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('online', 'cash') NOT NULL,
    payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    transaction_id VARCHAR(100),
    payment_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('booking', 'payment', 'assignment', 'general') DEFAULT 'general',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO boats (name, capacity, description) VALUES
('Safari Explorer I', 12, 'Comfortable boat with excellent wildlife viewing capabilities'),
('Safari Explorer II', 15, 'Larger boat perfect for group tours with safety equipment'),
('Safari Adventure', 8, 'Intimate boat for smaller groups with experienced captain');

INSERT INTO users (username, email, password_hash, first_name, last_name, role) VALUES
('admin', 'admin@boatsafari.com', '$2a$12$5dgXcA52aCMhGw8Qe8T/sOZbwkRXeW2FlokKI9RBVo2BoAxM3Bgda', 'System', 'Administrator', 'admin');

INSERT INTO users (username, email, password_hash, first_name, last_name, role) VALUES
('operations', 'ops@boatsafari.com', '$2a$12$5dgXcA52aCMhGw8Qe8T/sOZbwkRXeW2FlokKI9RBVo2BoAxM3Bgda', 'Operations', 'Manager', 'operations');

INSERT INTO users (username, email, password_hash, first_name, last_name, role) VALUES
('guide1', 'guide1@boatsafari.com', '$2a$12$5dgXcA52aCMhGw8Qe8T/sOZbwkRXeW2FlokKI9RBVo2BoAxM3Bgda', 'John', 'Safari', 'guide');

INSERT INTO users (username, email, password_hash, first_name, last_name, role, phone) VALUES
('customer1', 'customer@example.com', '$2a$12$5dgXcA52aCMhGw8Qe8T/sOZbwkRXeW2FlokKI9RBVo2BoAxM3Bgda', 'Jane', 'Doe', 'customer', '+1234567890');

INSERT INTO trips (title, description, price, duration_hours, max_capacity, departure_location, return_location, created_by) VALUES
('Morning Wildlife Safari', 'Experience the beauty of wildlife in their natural habitat during the peaceful morning hours. Perfect for photography and bird watching.', 75.00, 3, 12, 'Marina Bay Dock A', 'Marina Bay Dock A', 1),
('Sunset Safari Adventure', 'Enjoy a magical sunset while observing wildlife. Includes refreshments and professional guide commentary.', 95.00, 4, 15, 'Harbor Point Dock', 'Harbor Point Dock', 1),
('Full Day Safari Experience', 'Complete safari experience with lunch included. Visit multiple wildlife spots and enjoy a comprehensive tour.', 150.00, 8, 12, 'Main Pier', 'Main Pier', 1);

INSERT INTO trip_schedules (trip_id, scheduled_date, departure_time, return_time, available_seats, boat_id, guide_id) VALUES
(1, CURDATE() + INTERVAL 1 DAY, '08:00:00', '11:00:00', 12, 1, 3),
(2, CURDATE() + INTERVAL 1 DAY, '17:00:00', '21:00:00', 15, 2, 3),
(3, CURDATE() + INTERVAL 2 DAY, '09:00:00', '17:00:00', 12, 1, 3),
(1, CURDATE() + INTERVAL 3 DAY, '08:00:00', '11:00:00', 12, 3, 3),
(2, CURDATE() + INTERVAL 3 DAY, '17:00:00', '21:00:00', 15, 2, 3);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_reference ON bookings(booking_reference);
CREATE INDEX idx_trip_schedules_date ON trip_schedules(scheduled_date);
CREATE INDEX idx_notifications_user ON notifications(user_id);

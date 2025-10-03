# Boat Safari Trip Management System

A comprehensive web application for managing boat safari trips, bookings, and operations. This system provides role-based access for customers, guides, operations staff, and administrators.

## Features

### Customer Features
- Browse available safari trips
- View trip schedules and details
- Create bookings with passenger information
- Track booking status and payment
- User dashboard with booking history

### Guide Features
- View assigned trips and schedules
- Manage passenger check-ins
- Access trip details and passenger lists
- Trip history and performance tracking

### Operations Features
- Manage trip schedules
- Assign boats and guides to trips
- Monitor operational capacity
- Real-time scheduling updates

### Admin Features
- Complete system administration
- User management and role assignment
- Trip creation and management
- Booking status oversight
- System-wide analytics

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: MySQL/MariaDB
- **Authentication**: Session-based with JWT tokens
- **Frontend**: Vanilla HTML5, CSS3, JavaScript
- **Password Security**: bcrypt hashing
- **Validation**: express-validator

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- MySQL or MariaDB database server

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd BoatSafariTripManagementSystem
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
Create a MySQL/MariaDB database and import the schema:

```bash
mysql -u your_username -p your_database_name < database/schema.sql
```

### 4. Environment Configuration
Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=your_database_username
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

# Server Configuration
PORT=3000
JWT_SECRET=your_secure_jwt_secret_key

# Environment
NODE_ENV=development
```

### 5. Start the Application
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Database Schema

The system uses the following main tables:
- **users**: User accounts with role-based access
- **trips**: Safari trip definitions and details
- **trip_schedules**: Scheduled instances of trips
- **bookings**: Customer bookings and reservations
- **boats**: Fleet management
- **notifications**: System notifications

## Default User Accounts

The system comes with pre-configured accounts:

| Role | Username | Password | Access Level |
|------|----------|----------|--------------|
| Admin | admin | password123 | Full system access |
| Operations | operations | password123 | Operations management |
| Guide | guide1 | password123 | Trip guidance |
| Customer | customer1 | password123 | Booking and trips |

**Important**: Change these default passwords in production environments.

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

### Trips
- `GET /api/trips` - List all trips
- `GET /api/trips/:id` - Get trip details
- `POST /api/trips` - Create trip (Admin)
- `PUT /api/trips/:id` - Update trip (Admin)
- `DELETE /api/trips/:id` - Deactivate trip (Admin)

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/my` - Get user bookings
- `GET /api/bookings/:id` - Get booking details
- `PUT /api/bookings/:id/status` - Update booking status
- `POST /api/bookings/:id/payment` - Process payment

### Dashboard
- `GET /api/dashboard` - Role-based dashboard data
- `GET /api/dashboard/bookings` - Admin booking overview
- `GET /api/dashboard/schedules` - Schedule management

## Directory Structure

```
├── server/
│   ├── server.js           # Main application server
│   ├── config/
│   │   └── database.js     # Database configuration
│   ├── middleware/
│   │   └── auth.js         # Authentication middleware
│   └── routes/
│       ├── auth.js         # Authentication routes
│       ├── trips.js        # Trip management routes
│       ├── bookings.js     # Booking management routes
│       ├── users.js        # User management routes
│       └── dashboard.js    # Dashboard routes
├── public/
│   ├── css/
│   │   └── style.css       # Application styles
│   └── js/
│       └── auth.js         # Frontend authentication
├── views/
│   ├── index.html          # Homepage
│   ├── login.html          # Login page
│   ├── register.html       # Registration page
│   ├── trips.html          # Trip listings
│   ├── booking.html        # Booking form
│   ├── dashboard.html      # User dashboard
│   ├── admin.html          # Admin panel
│   ├── operations.html     # Operations panel
│   ├── guide.html          # Guide panel
│   └── payment.html        # Payment processing
├── database/
│   └── schema.sql          # Database schema and sample data
├── package.json            # Project dependencies
└── README.md              # This file
```

## Usage

### For Customers
1. Register an account or login
2. Browse available trips on the trips page
3. Select a trip schedule and make a booking
4. Complete payment and receive confirmation
5. View booking status in your dashboard

### For Guides
1. Login with guide credentials
2. Access your assigned trips in the guide panel
3. View passenger lists and trip details
4. Manage passenger check-ins during trips

### For Operations Staff
1. Login with operations credentials
2. Create and manage trip schedules
3. Assign boats and guides to trips
4. Monitor capacity and scheduling conflicts

### For Administrators
1. Login with admin credentials
2. Access the admin panel for full system control
3. Manage users, trips, and bookings
4. View system analytics and reports

## Development

### Running in Development Mode
```bash
npm run dev
```

### Database Migrations
When making database changes, update the schema.sql file and re-import:
```bash
mysql -u username -p database_name < database/schema.sql
```

## Security Features

- Password hashing with bcrypt
- Session-based authentication
- Role-based access control
- Input validation and sanitization
- SQL injection prevention
- XSS protection

## Troubleshooting

### Database Connection Issues
- Verify database credentials in `.env` file
- Ensure MySQL/MariaDB service is running
- Check database exists and user has proper permissions

### Port Already in Use
```bash
# Kill process using port 3000
sudo lsof -t -i:3000 | xargs sudo kill -9
```

### Session Issues
- Clear browser cookies and localStorage
- Restart the application server
- Verify JWT_SECRET is consistent

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For technical support or questions about the system, please refer to the documentation or contact the development team.
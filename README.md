# 🚢 Boat Safari Trip Management System

A comprehensive web-based application for managing boat safari trips, bookings, and operations. This system provides seamless experiences for customers while enabling administrators, operations staff, and guides to manage logistics efficiently.

## 🌟 Features

### For Customers
- **Trip Browsing**: Browse available safari trips with detailed information
- **Easy Booking**: Simple booking process with passenger details
- **Flexible Payment**: Pay online or cash on arrival
- **Booking Management**: View and manage bookings through dashboard
- **Notifications**: Receive booking confirmations and updates

### For Administrators
- **Trip Management**: Create, update, and manage safari trips
- **User Management**: Manage user accounts and roles
- **Booking Oversight**: View and manage all bookings
- **Revenue Tracking**: Monitor total revenue and bookings
- **System Analytics**: Dashboard with key metrics

### For Operations Staff
- **Resource Assignment**: Assign boats and guides to trips
- **Schedule Management**: Manage trip schedules and availability
- **Capacity Planning**: Monitor seat availability and bookings
- **Staff Coordination**: Coordinate between guides and boat assignments

### For Safari Guides
- **Assignment Tracking**: View assigned trips and schedules
- **Trip Details**: Access comprehensive trip information
- **Passenger Information**: View passenger counts and requirements
- **Notifications**: Receive assignment notifications

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Authentication**: JWT + Session-based
- **Payment**: Dummy payment gateway (Stripe simulation)
- **Email**: Nodemailer for notifications

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v14 or higher)
- [MySQL](https://www.mysql.com/) (v8.0 or higher)
- npm (comes with Node.js)

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd BoatSafariTripManagementSystem
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   - Create a MySQL database named `boat_safari_db`
   - Import the database schema:
   ```bash
   mysql -u root -p boat_safari_db < database/schema.sql
   ```

4. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Update the database and other configuration settings:
   ```env
   NODE_ENV=development
   PORT=3000
   
   # Database Configuration
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=boat_safari_db
   
   # JWT Secret
   JWT_SECRET=your_jwt_secret_key_here
   
   # Email Configuration (optional)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_email_password
   ```

5. **Start the application**
   ```bash
   # Development mode (with auto-restart)
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - Open your browser and navigate to `http://localhost:3000`
   - The application will be running with sample data

## 👥 Default User Accounts

The system comes with pre-configured user accounts for testing:

| Role | Username | Password | Access |
|------|----------|----------|--------|
| Admin | admin | admin123 | Full system access |
| Operations | operations | ops123 | Resource management |
| Guide | guide1 | guide123 | Assignment viewing |
| Customer | customer1 | customer123 | Booking and trips |

## 📖 Usage Guide

### Customer Journey
1. **Registration**: Create an account or login
2. **Browse Trips**: View available safari trips
3. **Book Trip**: Select schedule and provide passenger details
4. **Payment**: Choose online payment or cash on arrival
5. **Manage Bookings**: View bookings in dashboard

### Admin Operations
1. **Login**: Use admin credentials
2. **Trip Management**: Create and manage trip offerings
3. **User Management**: Manage user accounts and roles
4. **Booking Oversight**: Monitor all system bookings
5. **Analytics**: View system metrics and revenue

### Operations Workflow
1. **Assignment Management**: Assign boats and guides to scheduled trips
2. **Resource Monitoring**: Check boat and guide availability
3. **Schedule Coordination**: Ensure all trips have proper assignments
4. **Booking Confirmation**: Confirm bookings with complete assignments

### Guide Interface
1. **View Assignments**: Check assigned trips and schedules
2. **Trip Preparation**: Review trip details and passenger information
3. **Notifications**: Receive assignment updates

## 🗂️ Project Structure

```
BoatSafariTripManagementSystem/
├── server/                     # Backend server files
│   ├── config/                # Database configuration
│   ├── middleware/            # Authentication middleware
│   ├── routes/               # API routes
│   └── server.js            # Main server file
├── public/                    # Static frontend files
│   ├── css/                  # Stylesheets
│   ├── js/                   # JavaScript files
│   └── images/              # Image assets
├── views/                     # HTML pages
├── database/                  # Database schema and setup
├── package.json              # Dependencies and scripts
├── .env.example              # Environment configuration template
└── README.md                # This file
```

## 🔧 Configuration

### Database Configuration
Update the database settings in `.env`:
```env
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=boat_safari_db
```

### Email Configuration (Optional)
For notification emails, configure SMTP settings:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### Security Configuration
Set a strong JWT secret:
```env
JWT_SECRET=your_very_secure_secret_key_here
```

## 🧪 Testing

### Manual Testing
1. **User Registration/Login**: Test account creation and authentication
2. **Trip Booking Flow**: Complete booking process as customer
3. **Admin Functions**: Test trip creation and management
4. **Operations Workflow**: Test boat/guide assignments
5. **Role-based Access**: Verify proper access controls

### Sample Data
The system includes sample data:
- 3 boats with different capacities
- 3 sample trips with schedules
- User accounts for all roles
- Sample bookings and notifications

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production Deployment
1. **Set environment to production**
   ```env
   NODE_ENV=production
   ```

2. **Use process manager (PM2)**
   ```bash
   npm install -g pm2
   pm2 start server/server.js --name "boat-safari"
   ```

3. **Set up reverse proxy (Nginx)**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## 🔒 Security Features

- **Password Hashing**: Bcrypt encryption for user passwords
- **JWT Authentication**: Secure token-based authentication
- **Session Management**: Server-side session handling
- **Role-based Access Control**: Different access levels for user roles
- **Input Validation**: Server-side validation for all user inputs
- **SQL Injection Prevention**: Parameterized queries

## 🤝 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

### Trip Endpoints
- `GET /api/trips` - Get all trips
- `GET /api/trips/:id` - Get trip by ID
- `GET /api/trips/schedule/:scheduleId` - Get trip schedule

### Booking Endpoints
- `POST /api/bookings` - Create new booking
- `GET /api/bookings/my-bookings` - Get user's bookings
- `PUT /api/bookings/:id/confirm` - Confirm booking (Admin/Ops)
- `PUT /api/bookings/:id/cancel` - Cancel booking

### Dashboard Endpoints
- `GET /api/dashboard` - Get dashboard data (role-based)
- `GET /api/dashboard/boats` - Get boats list
- `PUT /api/dashboard/assign/:scheduleId` - Assign resources

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Email: support@boatsafari.com
- Documentation: Check this README and code comments

## 🗺️ Roadmap

### Phase 1 (Current)
- ✅ Basic booking system
- ✅ User management
- ✅ Trip scheduling
- ✅ Role-based dashboards

### Phase 2 (Future)
- 📧 Email notifications
- 📱 Mobile responsive improvements
- 💳 Real payment gateway integration
- 📊 Advanced analytics and reporting

### Phase 3 (Future)
- 📱 Mobile app
- 🌐 Multi-language support
- 🔔 SMS notifications
- 📈 Advanced business intelligence

## 🏆 Acknowledgments

- Built with modern web technologies
- Designed for scalability and maintainability
- Focused on user experience and security
- Comprehensive role-based access control

---

**Made with ❤️ for the safari tourism industry**

For questions or support, please open an issue or contact the development team.
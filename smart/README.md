# Smart Home Dashboard

A modern SvelteKit application for managing smart home devices, including Google Nest and smart bulbs.

## Features

- **Dashboard**: Monitor and control all your smart home devices from a central dashboard
- **Device Management**: Add, edit, and remove smart devices
- **Scene Management**: Create and activate scenes for different activities or times of day
- **Integration Support**: Connect with Google Nest and various smart bulb platforms
- **Responsive UI**: A modern, mobile-friendly user interface with dark mode support

## Technologies Used

- **SvelteKit**: Modern web framework for building fast, efficient web applications
- **TypeScript**: Type safety and better developer experience
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **Vitest**: Unit testing framework
- **Playwright**: End-to-end testing

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the smart directory:
   ```
   cd smart
   ```
3. Install dependencies:
   ```
   npm install
   ```

### Development

Run the development server:

```
npm run dev
```

The application will be available at http://localhost:5173.

### Testing

Run unit tests:

```
npm run test:unit
```

Run end-to-end tests:

```
npm run test:e2e
```

Run all tests:

```
npm run test
```

### Building for Production

```
npm run build
```

## Project Structure

- `/src`: Source code
  - `/lib`: Reusable components and utilities
  - `/routes`: SvelteKit routes (pages)
- `/static`: Static assets
- `/e2e`: End-to-end tests with Playwright

## Docker Support

This project includes Docker configuration for easy deployment and development. Use the provided Dockerfile.development for development environments.

## License

MIT

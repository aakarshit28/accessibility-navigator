# AccessWay AI Navigator 🏫♿

**AI-Powered Campus Accessibility Agent for Presidency University, Bengaluru**

AccessWay is a comprehensive, AI-driven web application designed to make navigating the 100-acre Presidency University campus safe, inclusive, and efficient for everyone. It provides real-time, adaptive routing and environmental awareness tailored to individual accessibility needs.

## 🌟 Key Features

### 1. Smart Campus Mapping
- **Interactive Map:** Built using Leaflet.js with CARTO Voyager and Esri World Imagery (satellite) base maps.
- **Accurate Campus Data:** Maps all major facilities (Admin Block, Library, Hostels, Sports Complex) with precise GPS coordinates.
- **Facility Pins:** Highlights accessible ramps, elevators, washrooms, drinking water, and parking.

### 2. AI Scene Analysis (Computer Vision)
- **Real-Time Obstacle Detection:** Uses TensorFlow.js and a pre-trained MobileNet model.
- **Camera Integration:** Analyzes the path ahead through the user's smartphone camera.
- **Contextual Warnings:** Detects stairs, vehicles, wet floors, and temporary construction barriers, providing visual and auditory alerts specifically prioritized for accessibility.

### 3. Adaptive Accessibility Profiles
Users can personalize their navigation experience based on their specific needs:
- 🚶 **Standard:** Fastest walking routes.
- ♿ **Wheelchair:** Step-free routes prioritizing ramps and elevators.
- 👁️ **Low Vision:** High-contrast UI, voice guidance, and simplified routing.
- 🎧 **Sensory:** Quieter routes with less traffic.
- 🧓 **Elderly:** Slower-paced routing focusing on smooth surfaces and rest areas.

### 4. Accessible Routing & Navigation
- **Turn-by-Turn Guidance:** Step-by-step textual and visual maneuver instructions.
- **Live ETA:** Calculates distance and estimated arrival time based on the selected profile.
- **Route Rating:** Users can rate routes and tag issues (e.g., "Uneven surface", "Poorly lit").

### 5. Safety & Emergency Integration
- **Emergency SOS:** One-tap button that drops a pin and provides instant dial links to Campus Security, Health Centre, and Ambulance.
- **Live Barrier Reporting:** Crowdsourced reporting for broken lifts, construction, or blocked paths. Generates live alerts for other users.
- **Emergency Contacts Panel:** Quick access to disability coordinators and hostel wardens.

### 6. Admin Dashboard & Predictive AI
- **Barrier Heatmaps:** Visualizes areas with frequent accessibility issues.
- **Usage Analytics:** Tracks daily active users and popular routes.
- **Predictive Intelligence:** Mocks BigQuery analytics to predict hourly campus traffic, identify problem areas, and offer AI recommendations (e.g., "Fix Engineering Block east entrance ramp").

### 7. Accessibility-First UI/UX
- **Voice Guidance:** Uses `window.speechSynthesis` to announce turns and obstacles.
- **Multilingual Support:** Interface supports English, Kannada, Hindi, and Tamil.
- **High Contrast & Dark Mode:** Built-in toggles to reduce eye strain and improve readability.
- **Offline Fallback:** Caches basic map data when the network is lost.

## 🛠️ Technical Stack
- **Frontend:** HTML5, Vanilla CSS3 (Custom Properties for theming), Vanilla JavaScript (ES6+).
- **Mapping:** Leaflet.js (Map rendering, custom markers, polyline routing).
- **AI / ML:** TensorFlow.js (`@tensorflow/tfjs`), MobileNet (`@tensorflow-models/mobilenet`).
- **Icons & Graphics:** Inline SVGs, Emojis for lightweight rendering.


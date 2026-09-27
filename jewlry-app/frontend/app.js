document.addEventListener('DOMContentLoaded', () => {
    // Fetch earrings from the backend
    fetchEarrings();
    setupUploadButton();
    fetchNosePins();
    setupNosePinUploadButton();

    // Tab switching between Earrings / Nose Pins panels
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });
  });
  

  async function fetchEarrings() {
    try {
      const response = await fetch('/api/earrings');
      const earrings = await response.json();
      
      // Display earrings in a selection menu
      displayEarringSelector(earrings);
    } catch (error) {
      console.error('Error fetching earrings:', error);
    }
  }
  
  function displayEarringSelector(earrings) {
    const selectorContainer = document.getElementById('earring-selector');
    
    const heading = selectorContainer.querySelector('h3');
    const uploadform = document.getElementById('upload-form');

    selectorContainer.innerHTML = '';
   selectorContainer.appendChild(heading);
   const noneButton = document.createElement('button');
    noneButton.className = 'earring-option';
    noneButton.innerHTML = `<span>None</span>`;
    noneButton.addEventListener('click', () => {
      window.selectEarring(null);
    });
    selectorContainer.appendChild(noneButton);

    // Create buttons for each earring
    earrings.forEach(earring => {
      const button = document.createElement('button');
      button.className = 'earring-option';
      button.innerHTML = `
        <img src="${earring.originalImageUrl}" alt="${earring.name}" height="50">
        <span>${earring.name}</span>
      `;
      
      button.addEventListener('click', () => {
        // Update the jewlImage source in earrings.js
        window.selectEarring(earring);
      });
      
      selectorContainer.appendChild(button);
    });

    selectorContainer.appendChild(uploadform);
  }

  // Helper: Resize and compress image on the phone before uploading
  async function compressImage(file, maxDimension = 800, quality = 0.85) {
    return new Promise((resolve) => {
      // If it's already small (< 500KB), don't compress
      if (file.size < 500 * 1024) {
        return resolve(file);
      }

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file); // fallback
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file); // fallback to original
      };

      img.src = url;
    });
  }

  function setupUploadButton() {
    const form = document.getElementById('earring-upload-form');
    const statusDiv = document.getElementById('upload-status');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const nameInput = document.getElementById('earring-name');
      const fileInput = document.getElementById('earring-image');
      const file = fileInput.files[0];
      if (!file) return;

      statusDiv.className = '';
      if (progressContainer) progressContainer.style.display = 'block';
      if (progressBar) { progressBar.style.width = '20%'; progressBar.textContent = 'Optimizing...'; }
      statusDiv.textContent = 'Optimizing photo for fast upload...';
     
    try {
      // 1. Fast client-side compression (reduces 10MB phone camera photo to ~150KB)
      const optimizedFile = await compressImage(file);

      if (progressBar) { progressBar.style.width = '50%'; progressBar.textContent = 'Uploading...'; }
      statusDiv.textContent = 'Uploading to server...';

      const formData = new FormData();
      formData.append('name', nameInput.value);
      formData.append('image', optimizedFile);

      if (progressBar) { progressBar.style.width = '75%'; progressBar.textContent = 'AI Processing...'; }
      statusDiv.textContent = 'Removing background with AI (almost done)...';

      console.log('Sending upload request to server...');
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      console.log('Server response status:', response.status);
      
      if (!response.ok) {
        let errorMsg = `Upload failed (${response.status})`;
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMsg = errorData.error || errorData.message || errorMsg;
          } else {
            const text = await response.text();
            const match = text.match(/<pre>([\s\S]*?)<\/pre>/i) || text.match(/<title>([\s\S]*?)<\/title>/i);
            errorMsg = match ? match[1].trim() : (text.slice(0, 120) || errorMsg);
          }
        } catch (_) {
          errorMsg = `Server error (${response.status})`;
        }
        throw new Error(errorMsg);
      }
      
      const result = await response.json();
      console.log('Upload success response:', result);
    
      if (progressBar) { progressBar.style.width = '100%'; progressBar.textContent = 'Done!'; }
      statusDiv.textContent = 'Earring uploaded successfully!';
      statusDiv.className = 'status-success';
      setTimeout(() => { if (progressContainer) progressContainer.style.display = 'none'; }, 2000);
      
      // Reset form
      nameInput.value = '';
      fileInput.value = '';
      
      // Refresh earring list
      fetchEarrings();
      
    } catch (error) {
      console.error('Error uploading earring:', error);
      if (progressContainer) progressContainer.style.display = 'none';
      statusDiv.textContent = `Error: ${error.message}`;
      statusDiv.className = 'status-error';
    }
  });
}  

  async function fetchNosePins() {
    try {
      const response = await fetch('/api/nosepins');
      const nosepins = await response.json();

      // Display nose pins in a selection menu
      displayNosePinSelector(nosepins);
    } catch (error) {
      console.error('Error fetching nose pins:', error);
    }
  }

  function displayNosePinSelector(nosepins) {
    const selectorContainer = document.getElementById('nosepin-selector');

    const heading = selectorContainer.querySelector('h3');
    const uploadform = document.getElementById('nosepin-upload-form');

    selectorContainer.innerHTML = '';
    selectorContainer.appendChild(heading);

    const noneButton = document.createElement('button');
    noneButton.className = 'earring-option';
    noneButton.innerHTML = `<span>None</span>`;
    noneButton.addEventListener('click', () => {
      window.selectNosepin(null);
    });
    selectorContainer.appendChild(noneButton);

    // Create buttons for each nose pin
    nosepins.forEach(nosepin => {
      const button = document.createElement('button');
      button.className = 'earring-option';
      button.innerHTML = `
        <img src="${nosepin.originalImageUrl}" alt="${nosepin.name}" height="50">
        <span>${nosepin.name}</span>
      `;

      button.addEventListener('click', () => {
        // Update the noseImage source in earrings.js
        window.selectNosepin(nosepin);
      });

      selectorContainer.appendChild(button);
    });

    selectorContainer.appendChild(uploadform);
  }

  function setupNosePinUploadButton() {
    const form = document.getElementById('nosepin-upload-form-el');
    const statusDiv = document.getElementById('nosepin-upload-status');
    const progressContainer = document.getElementById('nosepin-upload-progress-container');
    const progressBar = document.getElementById('nosepin-upload-progress-bar');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const nameInput = document.getElementById('nosepin-name');
      const fileInput = document.getElementById('nosepin-image');
      const file = fileInput.files[0];
      if (!file) return;

      statusDiv.className = '';
      if (progressContainer) progressContainer.style.display = 'block';
      if (progressBar) { progressBar.style.width = '20%'; progressBar.textContent = 'Optimizing...'; }
      statusDiv.textContent = 'Optimizing photo for fast upload...';

    try {
      const optimizedFile = await compressImage(file);

      if (progressBar) { progressBar.style.width = '50%'; progressBar.textContent = 'Uploading...'; }
      statusDiv.textContent = 'Uploading to server...';

      const formData = new FormData();
      formData.append('name', nameInput.value);
      formData.append('image', optimizedFile);

      if (progressBar) { progressBar.style.width = '75%'; progressBar.textContent = 'AI Processing...'; }
      statusDiv.textContent = 'Removing background with AI (almost done)...';

      console.log('Sending nose pin upload request to server...');
      const response = await fetch('/api/upload-nosepin', {
        method: 'POST',
        body: formData
      });

      console.log('Server response status:', response.status);

      if (!response.ok) {
        let errorMsg = `Upload failed (${response.status})`;
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMsg = errorData.error || errorData.message || errorMsg;
          } else {
            const text = await response.text();
            const match = text.match(/<pre>([\s\S]*?)<\/pre>/i) || text.match(/<title>([\s\S]*?)<\/title>/i);
            errorMsg = match ? match[1].trim() : (text.slice(0, 120) || errorMsg);
          }
        } catch (_) {
          errorMsg = `Server error (${response.status})`;
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      console.log('Nose pin upload success response:', result);

      if (progressBar) { progressBar.style.width = '100%'; progressBar.textContent = 'Done!'; }
      statusDiv.textContent = 'Nose pin uploaded successfully!';
      statusDiv.className = 'status-success';
      setTimeout(() => { if (progressContainer) progressContainer.style.display = 'none'; }, 2000);

      // Reset form
      nameInput.value = '';
      fileInput.value = '';

      // Refresh nose pin list
      fetchNosePins();

    } catch (error) {
      console.error('Error uploading nose pin:', error);
      if (progressContainer) progressContainer.style.display = 'none';
      statusDiv.textContent = `Error: ${error.message}`;
      statusDiv.className = 'status-error';
    }
  });
}
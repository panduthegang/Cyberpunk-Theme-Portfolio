const GITHUB_USERNAME = 'panduthegang';
let isLoading = false;
let retryTimeout = null;

// Show loading state
function showLoading() {
    isLoading = true;
    const activityList = document.getElementById('github-activities');
    activityList.innerHTML = `
        <div class="loading-state">
            <div class="loader-ring">
                <div></div><div></div><div></div><div></div>
            </div>
            <p>Fetching GitHub activity...</p>
        </div>
    `;
}

// Show error state
function showError(message) {
    const activityList = document.getElementById('github-activities');
    activityList.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
            <button onclick="retryFetch()" class="retry-button">
                <i class="fas fa-sync"></i> Retry
            </button>
        </div>
    `;
}

// Handle rate limiting
function handleRateLimit(response) {
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const resetTime = response.headers.get('X-RateLimit-Reset');

    if (remaining === '0') {
        const resetDate = new Date(resetTime * 1000);
        const minutes = Math.ceil((resetDate - new Date()) / 60000);
        throw new Error(`Rate limit exceeded. Please try again in ${minutes} minutes.`);
    }

    return response;
}

// Retry fetch after error
function retryFetch() {
    if (retryTimeout) {
        clearTimeout(retryTimeout);
    }
    fetchGitHubData();
}

// Fetch GitHub profile and activity data
async function fetchGitHubData() {
    if (isLoading) return;
    
    showLoading();
    try {
        // Fetch profile data
        const profileResponse = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}`)
            .then(handleRateLimit);
        
        if (!profileResponse.ok) {
            throw new Error('Failed to fetch profile data');
        }
        
        const profile = await profileResponse.json();

        // Update profile information with animation
        updateProfileInfo(profile);

        // Fetch recent activity with increased limit
        const eventsResponse = await fetch(
            `https://api.github.com/users/${GITHUB_USERNAME}/events/public?per_page=30`
        ).then(handleRateLimit);

        if (!eventsResponse.ok) {
            throw new Error('Failed to fetch activity data');
        }

        const events = await eventsResponse.json();
        
        // Filter out duplicate events and sort by date
        const uniqueEvents = filterUniqueEvents(events);
        displayActivities(uniqueEvents);

        // Update last fetch time
        updateLastFetchTime();
        
        isLoading = false;
    } catch (error) {
        console.error('Error fetching GitHub data:', error);
        showError(error.message);
        
        // Retry after 5 minutes if it's a rate limit error
        if (error.message.includes('Rate limit')) {
            retryTimeout = setTimeout(fetchGitHubData, 300000);
        }
        
        isLoading = false;
    }
}

// Filter unique events and sort by date
function filterUniqueEvents(events) {
    const seen = new Set();
    return events
        .filter(event => {
            const key = `${event.type}-${event.repo.name}-${event.created_at}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// Update profile information with animation
function updateProfileInfo(profile) {
    const elements = {
        'github-avatar': profile.avatar_url,
        'github-name': profile.name || profile.login,
        'github-bio': profile.bio || 'Full Stack Developer',
        'github-repos': `${profile.public_repos} Repositories`,
        'github-followers': `${profile.followers} Followers`,
        'github-following': `${profile.following} Following`
    };

    Object.entries(elements).forEach(([id, value], index) => {
        setTimeout(() => {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'github-avatar') {
                    element.src = value;
                    element.classList.add('loaded');
                } else {
                    element.textContent = value;
                    element.classList.add('fade-in');
                }
            }
        }, index * 100);
    });

    document.getElementById('github-profile-link').href = profile.html_url;
}

// Update last fetch time
function updateLastFetchTime() {
    const timeElement = document.createElement('div');
    timeElement.className = 'last-fetch-time';
    timeElement.innerHTML = `
        <i class="fas fa-sync"></i>
        Last updated: ${new Date().toLocaleTimeString()}
    `;
    
    const oldTimeElement = document.querySelector('.last-fetch-time');
    if (oldTimeElement) {
        oldTimeElement.remove();
    }
    
    document.querySelector('.feed-header').appendChild(timeElement);
}

// Display GitHub activities
function displayActivities(events) {
    const activityList = document.getElementById('github-activities');
    activityList.innerHTML = '';

    if (events.length === 0) {
        activityList.innerHTML = `
            <div class="no-activity">
                <i class="fas fa-coffee"></i>
                <p>No recent activity</p>
            </div>
        `;
        return;
    }

    events.slice(0, 10).forEach((event, index) => {
        const activityItem = createActivityItem(event);
        if (activityItem) {
            setTimeout(() => {
                activityList.appendChild(activityItem);
                activityItem.classList.add('fade-in');
            }, index * 100);
        }
    });
}

// Create activity item element
function createActivityItem(event) {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.dataset.type = getEventType(event.type);

    const content = getActivityContent(event);
    if (!content) return null;

    item.innerHTML = `
        <div class="activity-icon">
            <i class="${content.icon}"></i>
        </div>
        <div class="activity-content">
            <div class="activity-header">
                <span class="activity-title">${content.title}</span>
                <span class="activity-time">${formatDate(event.created_at)}</span>
            </div>
            <div class="activity-details">${content.details}</div>
            <a href="https://github.com/${event.repo.name}" class="activity-repo" target="_blank">
                ${event.repo.name}
            </a>
        </div>
    `;

    return item;
}

// Get event type for filtering
function getEventType(eventType) {
    if (eventType.includes('Push')) return 'push';
    if (eventType.includes('PullRequest')) return 'pr';
    if (eventType.includes('Issue')) return 'issue';
    return 'other';
}

// Get activity content based on event type
function getActivityContent(event) {
    switch (event.type) {
        case 'PushEvent':
            return {
                icon: 'fas fa-code-branch',
                title: 'Pushed to repository',
                details: `${event.payload.commits ? event.payload.commits.length : 0} commits`
            };
        case 'PullRequestEvent':
            return {
                icon: 'fas fa-code-pull-request',
                title: `${event.payload.action} pull request`,
                details: event.payload.pull_request.title
            };
        case 'IssuesEvent':
            return {
                icon: 'fas fa-exclamation-circle',
                title: `${event.payload.action} issue`,
                details: event.payload.issue.title
            };
        case 'CreateEvent':
            return {
                icon: 'fas fa-plus-circle',
                title: `Created ${event.payload.ref_type}`,
                details: event.payload.ref || ''
            };
        case 'DeleteEvent':
            return {
                icon: 'fas fa-minus-circle',
                title: `Deleted ${event.payload.ref_type}`,
                details: event.payload.ref
            };
        case 'WatchEvent':
            return {
                icon: 'fas fa-star',
                title: 'Starred repository',
                details: ''
            };
        case 'ForkEvent':
            return {
                icon: 'fas fa-code-branch',
                title: 'Forked repository',
                details: ''
            };
        default:
            return null;
    }
}

// Format date to relative time
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = (now - date) / 1000; // difference in seconds

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;
    return date.toLocaleDateString();
}

// Filter activities
function filterActivities(type) {
    const activities = document.querySelectorAll('.activity-item');
    activities.forEach(activity => {
        if (type === 'all' || activity.dataset.type === type) {
            activity.style.display = 'flex';
        } else {
            activity.style.display = 'none';
        }
    });

    // Update active filter button
    document.querySelectorAll('.feed-filter button').forEach(button => {
        button.classList.toggle('active', button.dataset.filter === type);
    });
}

// Initialize with loading animation
document.addEventListener('DOMContentLoaded', () => {
    // Add loading animation class to container
    const container = document.querySelector('.github-container');
    container.classList.add('loading');
    
    // Initial fetch
    fetchGitHubData();

    // Set up filter buttons with active state
    document.querySelectorAll('.feed-filter button').forEach(button => {
        button.addEventListener('click', () => {
            filterActivities(button.dataset.filter);
            
            // Update active state
            document.querySelectorAll('.feed-filter button').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
        });
    });

    // Refresh data every 5 minutes
    setInterval(() => {
        if (!document.hidden) {
            fetchGitHubData();
        }
    }, 300000);

    // Refresh when tab becomes visible
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            fetchGitHubData();
        }
    });
});

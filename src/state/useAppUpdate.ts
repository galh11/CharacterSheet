import { useCallback, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Service-worker update controls surfaced to the UI.
 *
 *  The deployed app is a PWA: a service worker precaches the build so it loads
 *  offline and instantly. The trade-off is that an open tab keeps serving the
 *  cached build until a newer service worker is fetched and activated — which is
 *  why a freshly deployed version doesn't appear right away. This hook exposes
 *  that machinery so the UI can (a) prompt to reload when a new build is ready
 *  and (b) force an immediate check on demand. */
export interface AppUpdate {
    /** True when a newly deployed build is waiting to take over on reload. */
    updateReady: boolean
    /** Force an immediate check with the server for a new deployment. Resolves
     *  to `true` when a new service worker is downloading or waiting. */
    checkForUpdate: () => Promise<boolean>
    /** Activate the waiting build and reload the page onto it. */
    applyUpdate: () => void
    /** Dismiss the "update ready" prompt without reloading. */
    dismiss: () => void
}

export function useAppUpdate(): AppUpdate {
    const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(_swUrl, registration) {
            registrationRef.current = registration
        },
    })

    const checkForUpdate = useCallback(async () => {
        const registration = registrationRef.current
        if (!registration) return false
        await registration.update()
        return Boolean(registration.installing ?? registration.waiting)
    }, [])

    const applyUpdate = useCallback(() => {
        void updateServiceWorker(true)
    }, [updateServiceWorker])

    const dismiss = useCallback(() => {
        setNeedRefresh(false)
    }, [setNeedRefresh])

    return { updateReady: needRefresh, checkForUpdate, applyUpdate, dismiss }
}

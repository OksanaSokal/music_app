// Компонент, срабатывающий после успешной OAuth авторизации,
// его цель - отправить код обратно в главное окно приложения и закрыть popup
import {useEffect} from "react";

export const OAuthCallback = () => {
    useEffect(() => {

        const url = new URL(window.location.href)

        const code = url.searchParams.get('code')

        if (code && window.opener) {
            window.opener.postMessage({ code }, '*')
        }

        window.close()
    }, [])

    return <p>Logging you in...</p>
}
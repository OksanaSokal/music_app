import type {
    CreatePlaylistArgs,
    FetchPlaylistsArgs,
    PlaylistCreatedEvent,
    PlaylistUpdatedEvent,
    UpdatePlaylistArgs
} from "@/features/playlists/api/playlistsApi.types.ts";
import {baseApi} from "@/app/api/baseApi.ts";
import type {Images} from "@/common/types";
import {playlistCreateResponseSchema, playlistsResponseSchema} from "@/features/playlists/model/playlists.schemas.ts";
import {imagesSchema} from "@/common/schemas";
import {withZodCatch} from "@/common/utils";
import {SOCKET_EVENTS} from "@/common/constants";
import {subscribeToEvent} from "@/common/socket";


export const playlistsApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        fetchPlaylists: build.query({
            query: (params: FetchPlaylistsArgs) => ({url: 'playlists', params}),
            ...withZodCatch(playlistsResponseSchema),
            keepUnusedDataFor: 0, // очистка сразу после размонтирования
            async onCacheEntryAdded(_arg, {updateCachedData, cacheDataLoaded, cacheEntryRemoved}) {
                await cacheDataLoaded

                const unsubscribes = [
                    subscribeToEvent<PlaylistCreatedEvent>(SOCKET_EVENTS.PLAYLIST_CREATED, msg => {
                        const newPlaylist = msg.payload.data
                        updateCachedData(state => {
                            state.data.pop()
                            state.data.unshift(newPlaylist)
                            state.meta.totalCount = state.meta.totalCount + 1
                            state.meta.pagesCount = Math.ceil(state.meta.totalCount / state.meta.pageSize)
                        })
                    }),
                    subscribeToEvent<PlaylistUpdatedEvent>(SOCKET_EVENTS.PLAYLIST_UPDATED, msg => {
                        const newPlaylist = msg.payload.data
                        updateCachedData(state => {
                            const index = state.data.findIndex(playlist => playlist.id === newPlaylist.id)
                            if (index !== -1) {
                                state.data[index] = { ...state.data[index], ...newPlaylist }
                            }
                        })
                    }),
                ]

                await cacheEntryRemoved
                unsubscribes.forEach(unsubscribe => unsubscribe())
            },
            providesTags: ['Playlist']
        }),
        createPlaylist: build.mutation({
            query: (body: CreatePlaylistArgs) => ({
                url: 'playlists',
                method: 'post',
                body,
            }),
            ...withZodCatch(playlistCreateResponseSchema),
            invalidatesTags: ['Playlist']
        }),
        deletePlaylist: build.mutation<void, string>({
            query: playlistId => ({
                url: `playlists/${playlistId}`,
                method: 'delete',
            }),
            invalidatesTags: ['Playlist']
        }),
        updatePlaylist: build.mutation<void, { body: UpdatePlaylistArgs, playlistId: string }>({
            query: ({body, playlistId}) => ({
                url: `playlists/${playlistId}`,
                method: 'put',
                body,
            }),
            onQueryStarted: async ({playlistId, body}, {queryFulfilled, dispatch, getState}) => {

                const args = playlistsApi.util.selectCachedArgsForQuery(getState(), 'fetchPlaylists')

                const patchCollections: any[] = []

                args.forEach(arg => patchCollections.push(dispatch(
                    playlistsApi.util.updateQueryData('fetchPlaylists', {
                        pageNumber: arg.pageNumber,
                        pageSize: arg.pageSize,
                        search: arg.search
                    }, (state) => {
                        const index = state.data.findIndex(playlist => playlist.id === playlistId)
                        if (index !== -1) state.data[index].attributes = {...state.data[index].attributes, ...body}
                    }),
                )))


                try {
                    await queryFulfilled
                } catch (e) {
                    patchCollections.forEach(patchCollection => {
                        patchCollection.undo()
                    })
                }
            },
            invalidatesTags: ['Playlist']
        }),
        uploadPlaylistCover: build.mutation<Images, { file: File, playlistId: string }>({
            query: ({file, playlistId}) => {
                const formData = new FormData()
                formData.append('file', file)

                return ({
                    url: `/playlists/${playlistId}/images/main`,
                    method: 'post',
                    body: formData,
                });
            },
            ...withZodCatch(imagesSchema),
            invalidatesTags: ['Playlist']
        }),
        deletePlaylistCover: build.mutation<void, { playlistId: string }>({
            query: ({playlistId}) => ({
                url: `playlists/${playlistId}/images/main`,
                method: 'delete',
            }),
            invalidatesTags: ['Playlist']
        }),
    }),
})

export const {
    useFetchPlaylistsQuery,
    useCreatePlaylistMutation,
    useDeletePlaylistMutation,
    useUpdatePlaylistMutation,
    useUploadPlaylistCoverMutation,
    useDeletePlaylistCoverMutation
} = playlistsApi
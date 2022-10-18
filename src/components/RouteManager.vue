<template>
<v-container>
  <v-row>
    <v-autocomplete
        v-model="model"
        :items="entries"
        :loading="isLoading"
        :search-input.sync="search"
        color="white"
        filled
        chips
        item-text="name"
        item-value="id"
        label="Route Waypoints"
        placeholder="Start typing to Search"
        prepend-icon="mdi-database-search"
        return-object
        multiple
        no-filter
        deletable-chips
        hide-selected
        @input="onSelect"
        >
    </v-autocomplete>
  </v-row>
</v-container>
</template>

<script lang="ts">
  import Vue from 'vue'

  export default Vue.extend({
    name: 'RouteManager',

    data: () => ({
      entries: [],
      isLoading: false,
      model: null,
      search: null,
      count: null
    }),

    methods: {
      async onSelect (selected: any) {
        this.search = null
      }
    },

    watch: {
      search (val) {
        if (!val) return
        // Items have already been loaded
        // if (this.items.length > 0) return

        // Items have already been requested
        if (this.isLoading) return

        this.isLoading = true

        // Lazily load input items
        fetch('systems?' + new URLSearchParams({ val }))
          .then(res => res.json())
          .then(res => {
            console.log(res)
            const { count, entries } = res
            this.count = count
            this.entries = entries.concat(this.model)
          })
          .catch(err => {
            console.log(err)
          })
          .finally(() => (this.isLoading = false))
      },
    },
  })
</script>

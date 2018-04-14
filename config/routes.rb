Rails.application.routes.draw do
  devise_for :admins, skip: :all
  devise_for :boys
  devise_for :girls
  as :admin do
    get 'login_admin', to: 'devise/sessions#new', as: :new_admin_session
    post 'login_admin', to: 'devise/sessions#create', as: :admin_session
    delete 'logout_admin', to: 'devise/sessions#destroy', as: :destroy_admin_session
  end
  get 'welcome/index'
  get 'rules' => 'welcome#rules'
  get 'main' => 'logged#index'
  get 'main_boy' => 'main_boy#index'
  get 'main_girl' => 'main_girl#index'
  get 'main_admin' => 'main_admin#index'
  get 'reports' => 'main_admin#reports'
  get 'cv_serch' => 'main_admin#cv_search', as: :cv_search
  get 'usr_search' => 'user_search#usr_search', as: :usr_search
  # post 'report' => 'complaints#new', as: :report
  resource :complaint, only: :create, as: :report
  post 'ban_reported' => 'complaints#ban_reported', as: :ban_reported
  post 'ban_sender' => 'complaints#ban_sender', as: :ban_sender
  post 'ignore' => 'complaints#ignore', as: :ignore
  get 'banned' => 'ban#banned'
  get 'users/:id' => 'users#show', as: :users
  get 'conversation' => 'conversation#index'
  get 'conversations/:id' => 'conversations#show', as: :conversations
  post '/conversation/leave' => 'conversation#leave', as: :leave_cv
  resources :messages
  root 'welcome#index'
end
